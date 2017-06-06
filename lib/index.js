'use strict';

var jPath = require('json-path');
var Queue = require('async-function-queue');
var extend = require('xtend');
var equal = require('deep-equal');

/* istanbul ignore next */
function warn(what) {
  var fn = console.warn || console.log; // eslint-disable-line no-console
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

function differences(oldDocs, newDocs) {
  var result = {
    new: [],
    updated: [],
    deleted: Object.keys(oldDocs).map(function (oldDocId) {
      return oldDocs[oldDocId];
    })
  };

  var checkDoc = function checkDoc(newDoc) {
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
  };

  if (Array.isArray(newDocs)) {
    newDocs.forEach(function (doc) {
      checkDoc(doc);
    });
  } else {
    var keys = Object.keys(newDocs);
    keys.forEach(function (key) {
      checkDoc(newDocs[key]);
    });
  }

  return result;
}

function write(data, responseHandler) {
  return function (done) {
    data.db[data.type](data.doc, function (err, resp) {
      responseHandler(err, {
        response: resp,
        doc: data.doc,
        type: data.type
      }, function (err2) {
        done(err2, resp);
      });
    });
  };
}

function onDbChange(path, change, dispatch) {
  var changeDoc = change.doc;

  if (path.changeFilter && !path.changeFilter(changeDoc)) {
    return;
  }

  if (changeDoc._deleted) {
    if (path.docs[changeDoc._id]) {
      delete path.docs[changeDoc._id];
      path.propagateDelete(changeDoc, dispatch);
    }
  } else {
    var oldDoc = path.docs[changeDoc._id];
    path.docs[changeDoc._id] = changeDoc;
    if (oldDoc) {
      path.propagateUpdate(changeDoc, dispatch);
    } else {
      path.propagateInsert(changeDoc, dispatch);
    }
  }
}

function listen(path, dispatch, initialBatchDispatched) {
  path.db.allDocs({ include_docs: true }).then(function (rawAllDocs) {
    var allDocs = rawAllDocs.rows.map(function (doc) {
      return doc.doc;
    });
    var filteredAllDocs = allDocs;
    if (path.changeFilter) {
      filteredAllDocs = allDocs.filter(path.changeFilter);
    }
    filteredAllDocs.forEach(function (doc) {
      path.docs[doc._id] = doc;
    });
    path.propagateBatchInsert(filteredAllDocs, dispatch);
    initialBatchDispatched();
    var changes = path.db.changes({
      live: true,
      include_docs: true,
      since: 'now'
    });
    changes.on('change', function (change) {
      onDbChange(path, change, dispatch);
    });
  }).catch(function (err) {
    return initialBatchDispatched(err);
  });
}

function processNewStateForPath(path, state) {
  var pathDocs = jPath.resolve(state, path.path);

  /* istanbul ignore else */
  if (pathDocs && pathDocs.length) {
    pathDocs.forEach(function (docs) {
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

function createPouchMiddleware(_paths) {
  var paths = _paths || [];
  if (!Array.isArray(paths)) {
    paths = [paths];
  }

  if (!paths.length) {
    throw new Error('PouchMiddleware: no paths');
  }

  function scheduleInsert(doc) {
    this.docs[doc._id] = doc;
    this.queue.push(write({
      type: 'put',
      doc: doc,
      db: this.db
    }, this.handleResponse));
  }

  function scheduleRemove(doc) {
    delete this.docs[doc._id];
    this.queue.push(write({
      type: 'remove',
      doc: doc,
      db: this.db
    }, this.handleResponse));
  }

  function propagateDelete(doc, dispatch) {
    dispatch(this.actions.remove(doc));
  }

  function propagateInsert(doc, dispatch) {
    dispatch(this.actions.insert(doc));
  }

  function propagateUpdate(doc, dispatch) {
    dispatch(this.actions.update(doc));
  }

  function propagateBatchInsert(docs, dispatch) {
    dispatch(this.actions.batchInsert(docs));
  }

  var defaultSpec = {
    path: '.',
    remove: scheduleRemove,
    insert: scheduleInsert,
    propagateDelete: propagateDelete,
    propagateUpdate: propagateUpdate,
    propagateInsert: propagateInsert,
    propagateBatchInsert: propagateBatchInsert,
    handleResponse: function handleResponse(err, data, cb) {
      cb(err);
    },

    queue: Queue(1),
    docs: {},
    actions: {
      remove: defaultAction('remove'),
      update: defaultAction('update'),
      insert: defaultAction('insert'),
      batchInsert: defaultAction('batchInsert')
    }
  };

  paths = paths.map(function (path) {
    var spec = extend({}, defaultSpec, path);
    spec.actions = extend({}, defaultSpec.actions, spec.actions);
    spec.docs = {};

    if (!spec.db) {
      throw new Error('path ' + path.path + ' needs a db');
    }
    return spec;
  });

  return function (options) {
    paths.forEach(function (path) {
      listen(path, options.dispatch, function (err) {
        if (path.initialBatchDispatched) {
          path.initialBatchDispatched(err);
        }
      });
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

module.exports = createPouchMiddleware;