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
    propagateDelete,
    propagateUpdate,
    propagateInsert,
    propagateBatchInsert,
    handleResponse: function(err, data, cb) { cb(err); },
    queue: Queue(1),
    docs: {},
    actions: {
      remove: defaultAction('remove'),
      update: defaultAction('update'),
      insert: defaultAction('insert'),
      batchInsert: defaultAction('batchInsert'),
    }
  }

  paths = paths.map(function(path) {
    var spec = extend({}, defaultSpec, path);
    spec.actions = extend({}, defaultSpec.actions, spec.actions);
    spec.docs = {};

    if (! spec.db) {
      throw new Error('path ' + path.path + ' needs a db');
    }
    return spec;
  });

  var subscriptions = [];
  function subscribeToChanges(db){
    var found = subscriptions.find(function(subDb) {
      return subDb.db === db
    });

    if (found != null){
      return found.changes;
    }

    var changes = db.changes({
      live: true,
      include_docs: true,
      since: 'now',
    });

    subscriptions.push({ db: db, changes: changes});
    return changes;
  }

  function listen(path, dispatch, initialBatchDispatched) {
    path.db.allDocs({ include_docs: true }).then((rawAllDocs) => {
      var allDocs = rawAllDocs.rows.map((doc) => doc.doc);
      var filteredAllDocs = allDocs;
      if (path.changeFilter) {
        filteredAllDocs = allDocs.filter(path.changeFilter);
      }
      filteredAllDocs.forEach((doc) => {
        path.docs[doc._id] = doc;
      });
      path.propagateBatchInsert(filteredAllDocs, dispatch);
      initialBatchDispatched();
      var changes = subscribeToChanges(path.db);
      changes.on('change', change => {
        onDbChange(path, change, dispatch);
      });
    }).catch((err) => initialBatchDispatched(err));
  }

  function processNewStateForPath(path, state) {
    var docs = jPath.resolve(state, path.path);

    /* istanbul ignore else */
    if (docs && docs.length) {
      docs.forEach(function(docs) {
        var diffs = differences(path.docs, docs);
        diffs.new.concat(diffs.updated).forEach(doc => path.insert(doc))
        diffs.deleted.forEach(doc => path.remove(doc));
      });
    }
  }

  function write(data, responseHandler) {
    return function(done) {
      data.db[data.type](data.doc, function(err, resp) {
        responseHandler(
          err,
          {
            response: resp,
            doc: data.doc,
            type: data.type
          },
          function(err2) {
            done(err2, resp);
          }
        );
      });
    };
  }

  function scheduleInsert(doc) {
    this.docs[doc._id] = doc;
    this.queue.push(write(
      {
        type: 'put',
        doc: doc,
        db: this.db
      },
      this.handleResponse
    ));
  }

  function scheduleRemove(doc) {
    delete this.docs[doc._id];
    this.queue.push(write(
      {
        type: 'remove',
        doc: doc,
        db: this.db
      },
      this.handleResponse
    ));
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

  return function(options) {
    paths.forEach((path) => {
      listen(path, options.dispatch, (err) => {
        if (path.initialBatchDispatched) {
          path.initialBatchDispatched(err);
        }
      });
    });

    return function(next) {
      return function(action) {
        var returnValue = next(action);
        var newState = options.getState();

        paths.forEach(path => processNewStateForPath(path, newState));

        return returnValue;
      }
    }
  }
}

function differences(oldDocs, newDocs) {
  var result = {
    new: [],
    updated: [],
    deleted: Object.keys(oldDocs).map(oldDocId => oldDocs[oldDocId]),
  };

  var checkDoc = function(newDoc) {
    var id = newDoc._id;

    /* istanbul ignore next */
    if (! id) {
      warn('doc with no id');
    }
    result.deleted = result.deleted.filter(doc => doc._id !== id);
    var oldDoc = oldDocs[id];
    if (! oldDoc) {
      result.new.push(newDoc);
    } else if (!equal(oldDoc, newDoc)) {
      result.updated.push(newDoc);
    }
  };

  if (Array.isArray(newDocs)){
    newDocs.forEach(function (doc) {
      checkDoc(doc)
    });
  } else{
    var keys = Object.keys(newDocs);
    for (var key in newDocs){
      checkDoc(newDocs[key])
    }
  }


  return result;
}

function onDbChange(path, change, dispatch) {
  var changeDoc = change.doc;

  if(path.changeFilter && (! path.changeFilter(changeDoc))) {
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

/* istanbul ignore next */
function warn(what) {
  var fn = console.warn || console.log;
  if (fn) {
    fn.call(console, what);
  }
}

/* istanbul ignore next */
function defaultAction(action) {
  return function() {
    throw new Error('no action provided for ' + action);
  };
}
