# pouch-redux-middleware

[![By](https://img.shields.io/badge/made%20by-yld!-32bbee.svg?style=flat)](http://yld.io/contact?source=github-pouch-redux-middleware)
[![Build Status](https://secure.travis-ci.org/pgte/pouch-redux-middleware.svg?branch=master)](http://travis-ci.org/pgte/pouch-redux-middleware?branch=master)

Redux Middleware for syncing state and a PouchDB database.

Propagates changes made to a state into PouchDB.
Propagates changes made to PouchDB into the state.

## Install

```
$ npm install pouch-redux-middleware --save
```

## Overview

pouch-redux-middleware will automatically populate a part of the store, specified by `path`, with the documents using the specified actions. This "sub-state" will be a list of the documents straight out of the database. When the database is modified by a 3rd party (e.g. by replication) a Redux action will be dispatched to update the "sub-state". Conversely, if you alter a document within the "sub-state", then the document will be updated in the database.

* If a new document is created in the database (e.g. by replication or directly using `db.post`), then the corresponding  `insert` action will be dispatched. If a document is updated in the database (e.g. by replication or directly), then the corresponding `update` action will be dispatched. If a document is deleted in the database (e.g. by replication or directly), then the corresponding `remove` action will be dispatched.
* If you add a document to the "sub-state", then the document will be added to the database automatically (you should specify keys such as `_id`). If you alter a document in the "sub-state", the document will be updated in the database automatically. If you remove a document from the "sub-state", the document will be removed from the database automatically.
* You may specify that that only a subset of the database's documents should populate the store by using `changeFilter` which effectively filters the documents under consideration.

## Example

Example of configuring a store:

```js
import * as types from '../constants/ActionTypes'
import PouchMiddleware from 'pouch-redux-middleware'
import { createStore, applyMiddleware } from 'redux'
import rootReducer from '../reducers'
import PouchDB from 'pouchdb'

export default function configureStore() {
  const db = new PouchDB('todos');

  const pouchMiddleware = PouchMiddleware({
    path: '/todos',
    db,
    actions: {
      remove: doc => { return { type: types.DELETE_TODO, id: doc._id } },
      insert: doc => { return { type: types.INSERT_TODO, todo: doc } },
      batchInsert: docs => { return { type: types.BATCH_INSERT_TODOS, todos: docs } }
      update: doc => { return { type: types.UPDATE_TODO, todo: doc } },
    }
  })

  const store = createStore(
    rootReducer,
    undefined,
    applyMiddleware(pouchMiddleware)
  )

  return store
}
```

## API

### PouchMiddleware(paths)

* `paths`: path or array containing path specs

A path spec is an object describing the behaviour of a sub-tree of the state it has the following attributes:

* `path`: a JsonPath path where the documents will stored in the state as an array
* `db`: a PouchDB database
* `actions`: an object describing the actions to perform when initially inserting items and when a change occurs in the db.
It's an object with keys containing a function that returns an action for each
of the events (`remove`, `insert`, `batchInsert` and `update`)
* `changeFilter`: a filtering function that receives a changed document, and if it returns
false, the document will be ignored for the path. This is useful when you have
multiple paths in a single database that are differentiated through an attribute
(like `type`).
* `handleResponse` a function that is invoked with the direct response of the database,
which is useful when metadata is needed or errors need custom handling.
Arguments are `error, data, callback`. `callback` must be invoked with a potential error
after custom handling is done.
* `initialBatchDispatched` a function that is invoked once the initial set of
data has been read from pouchdb and dispatched to the redux store.
This comes handy if you want skip the initial updates to a store
subscriber by delaying the subscription to the redux store
until the initial state is present. For example, when your application is first
loaded you may wish to delay rendering until the store is updated.

Example of a path spec:

```js
{
  path: '/todos',
  db,
  actions: {
    remove: doc => { return { type: types.DELETE_TODO, id: doc._id } },
    insert: doc => { return { type: types.INSERT_TODO, todo: doc } },
    batchInsert: docs => { return { type: types.BATCH_INSERT_TODOS, todos: docs } }
    update: doc => { return { type: types.UPDATE_TODO, todo: doc } },
  }
}
```

## License

ISC
