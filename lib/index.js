'use strict';

var jPath = require('json-path');
var Queue = require('async-function-queue');
var extend = require('xtend');
var equal = require('deep-equal');

module.exports = createPouchMiddleware;

function createPouchMiddleware(_paths) {
  var paths = _paths || [];
  if (!Array.isArray(paths)) {
    paths = [paths];
  }

  if (!paths.length) {
    throw new Error('PouchMiddleware: no paths');
  }

  var defaultSpec = {
    path: '.',
    remove: scheduleRemove,
    insert: scheduleInsert,
    propagateDelete: propagateDelete,
    propagateUpdate: propagateUpdate,
    propagateInsert: propagateInsert,
    queue: Queue(1),
    docs: {},
    actions: {
      remove: defaultAction('remove'),
      update: defaultAction('update'),
      insert: defaultAction('insert')
    }
  };

  paths = paths.map(function (path) {
    var spec = extend({}, defaultSpec, path);
    spec.actions = extend({}, defaultSpec.actions, spec.actions);
    spec.docs = {};

    if (!spec.db) {
      throw new Error('path ' + path.pth + ' needs a db');
    }
    return spec;
  });

  function listen(path) {
    var changes = path.db.changes({ live: true, include_docs: true });
    changes.on('change', function (change) {
      return onDbChange(path, change);
    });
  }

  function processNewStateForPath(path, state) {
    var docs = jPath.resolve(state, path.path);

    /* istanbul ignore else */
    if (docs && docs.length) {
      docs.forEach(function (docs) {
        var diffs = differences(path.docs, docs);
        diffs.new.concat(diffs.updated).forEach(function (doc) {
          return path.insert(doc);
        });
        diffs.deleted.forEach(function (doc) {
          return path.remove(doc);
        });
      });
    }
  }

  function scheduleInsert(doc) {
    this.docs[doc._id] = doc;
    var db = this.db;
    this.queue.push(function (cb) {
      db.put(doc, cb);
    });
  }

  function scheduleRemove(doc) {
    delete this.docs[doc._id];
    var db = this.db;
    this.queue.push(function (cb) {
      db.remove(doc, cb);
    });
  }

  function propagateDelete(doc) {
    this.actions.remove(doc, this.dispatch);
  }

  function propagateInsert(doc) {
    this.actions.insert(doc, this.dispatch);
  }

  function propagateUpdate(doc) {
    this.actions.update(doc, this.dispatch);
  }

  return function (options) {
    paths.forEach(listen);
	
	paths.forEach(function (path) {
      path.dispatch = options.dispatch;
    });

    return function (next) {
      return function (action) {
        var returnValue = next(action);
        var newState = options.getState();

        paths.forEach(function (path) {
          return processNewStateForPath(path, newState);
        });

        return returnValue;
      };
    };
  };
}

function differences(oldDocs, newDocs) {
  var result = {
    new: [],
    updated: [],
    deleted: Object.keys(oldDocs).map(function (oldDocId) {
      return oldDocs[oldDocId];
    })
  };

  newDocs.forEach(function (newDoc) {
    var id = newDoc._id;

    /* istanbul ignore next */
    if (!id) {
      warn('doc with no id');
    }
    result.deleted = result.deleted.filter(function (doc) {
      return doc._id !== id;
    });
    var oldDoc = oldDocs[id];
    if (!oldDoc) {
      result.new.push(newDoc);
    } else if (!equal(oldDoc, newDoc)) {
      result.updated.push(newDoc);
    }
  });

  return result;
}

function onDbChange(path, change) {
  var changeDoc = change.doc;

  if (path.changeFilter && !path.changeFilter(changeDoc)) {
    return;
  }

  if (changeDoc._deleted) {
    if (path.docs[changeDoc._id]) {
      delete path.docs[changeDoc._id];
      path.propagateDelete(changeDoc);
    }
  } else {
    var oldDoc = path.docs[changeDoc._id];
    path.docs[changeDoc._id] = changeDoc;
    if (oldDoc) {
      path.propagateUpdate(changeDoc);
    } else {
      path.propagateInsert(changeDoc);
    }
  }
}

/* istanbul ignore next */
function warn(what) {
  var fn = console.warn || console.log;
  if (fn) {
    fn.call(console, what);
  }
}

/* istanbul ignore next */
function defaultAction(action) {
  return function () {
    throw new Error('no action provided for ' + action);
  };
}