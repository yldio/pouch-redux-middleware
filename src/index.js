const jPath = require('json-path');
const Queue = require('async-function-queue');
const extend = require('xtend');
const equal = require('deep-equal');

/* istanbul ignore next */
function warn(what) {
  const fn = console.warn || console.log; // eslint-disable-line no-console
  if (fn) {
    fn.call(console, what);
  }
}

/* istanbul ignore next */
function defaultAction(action) {
  return () => {
    throw new Error(`no action provided for ${action}`);
  };
}

function differences(oldDocs, newDocs) {
  const result = {
    new: [],
    updated: [],
    deleted: Object.keys(oldDocs).map(oldDocId => oldDocs[oldDocId]),
  };

  const checkDoc = newDoc => {
    const id = newDoc._id;

    /* istanbul ignore next */
    if (!id) {
      warn('doc with no id');
    }
    result.deleted = result.deleted.filter(doc => doc._id !== id);
    const oldDoc = oldDocs[id];
    if (!oldDoc) {
      result.new.push(newDoc);
    } else if (!equal(oldDoc, newDoc)) {
      result.updated.push(newDoc);
    }
  };

  if (Array.isArray(newDocs)) {
    newDocs.forEach(doc => {
      checkDoc(doc);
    });
  } else {
    const keys = Object.keys(newDocs);
    keys.forEach(key => {
      checkDoc(newDocs[key]);
    });
  }

  return result;
}

function write(data, responseHandler) {
  return done => {
    data.db[data.type](data.doc, (err, resp) => {
      responseHandler(
        err,
        {
          response: resp,
          doc: data.doc,
          type: data.type,
        },
        err2 => {
          done(err2, resp);
        }
      );
    });
  };
}

function onDbChange(path, change, dispatch) {
  const changeDoc = change.doc;

  if (path.changeFilter && !path.changeFilter(changeDoc)) {
    return;
  }

  if (changeDoc._deleted) {
    if (path.docs[changeDoc._id]) {
      delete path.docs[changeDoc._id];
      path.propagateDelete(changeDoc, dispatch);
    }
  } else {
    const oldDoc = path.docs[changeDoc._id];
    path.docs[changeDoc._id] = changeDoc;
    if (oldDoc) {
      path.propagateUpdate(changeDoc, dispatch);
    } else {
      path.propagateInsert(changeDoc, dispatch);
    }
  }
}

function listen(path, dispatch, initialBatchDispatched) {
  path.db
    .allDocs({ include_docs: true })
    .then(rawAllDocs => {
      const allDocs = rawAllDocs.rows.map(doc => doc.doc);
      let filteredAllDocs = allDocs;
      if (path.changeFilter) {
        filteredAllDocs = allDocs.filter(path.changeFilter);
      }
      filteredAllDocs.forEach(doc => {
        path.docs[doc._id] = doc;
      });
      path.propagateBatchInsert(filteredAllDocs, dispatch);
      initialBatchDispatched();
      const changes = path.db.changes({
        live: true,
        include_docs: true,
        since: 'now',
      });
      changes.on('change', change => {
        onDbChange(path, change, dispatch);
      });
    })
    .catch(err => initialBatchDispatched(err));
}

function processNewStateForPath(path, state) {
  const pathDocs = jPath.resolve(state, path.path);

  /* istanbul ignore else */
  if (pathDocs && pathDocs.length) {
    pathDocs.forEach(docs => {
      const diffs = differences(path.docs, docs);
      diffs.new.concat(diffs.updated).forEach(doc => path.insert(doc));
      diffs.deleted.forEach(doc => path.remove(doc));
    });
  }
}

function createPouchMiddleware(_paths) {
  let paths = _paths || [];
  if (!Array.isArray(paths)) {
    paths = [paths];
  }

  if (!paths.length) {
    throw new Error('PouchMiddleware: no paths');
  }

  function scheduleInsert(doc) {
    this.docs[doc._id] = doc;
    this.queue.push(
      write(
        {
          type: 'put',
          doc,
          db: this.db,
        },
        this.handleResponse
      )
    );
  }

  function scheduleRemove(doc) {
    delete this.docs[doc._id];
    this.queue.push(
      write(
        {
          type: 'remove',
          doc,
          db: this.db,
        },
        this.handleResponse
      )
    );
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

  const defaultSpec = {
    path: '.',
    /* eslint-disable no-use-before-define */
    remove: scheduleRemove,
    insert: scheduleInsert,
    propagateDelete,
    propagateUpdate,
    propagateInsert,
    propagateBatchInsert,
    /* eslint-enable no-use-before-define */
    handleResponse(err, data, cb) {
      cb(err);
    },
    queue: Queue(1),
    docs: {},
    actions: {
      remove: defaultAction('remove'),
      update: defaultAction('update'),
      insert: defaultAction('insert'),
      batchInsert: defaultAction('batchInsert'),
    },
  };

  paths = paths.map(path => {
    const spec = extend({}, defaultSpec, path);
    spec.actions = extend({}, defaultSpec.actions, spec.actions);
    spec.docs = {};

    if (!spec.db) {
      throw new Error(`path ${path.path} needs a db`);
    }
    return spec;
  });

  return options => {
    paths.forEach(path => {
      listen(path, options.dispatch, err => {
        if (path.initialBatchDispatched) {
          path.initialBatchDispatched(err);
        }
      });
    });

    return next => action => {
      const returnValue = next(action);
      const newState = options.getState();

      paths.forEach(path => processNewStateForPath(path, newState));

      return returnValue;
    };
  };
}

module.exports = createPouchMiddleware;
