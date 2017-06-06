'use strict';

const Lab = require('lab');
const PouchDB = require('pouchdb');
const memdown = require('memdown');
const Code = require('code');
const actionTypes = require('./_action_types');
const rootReducer = require('./reducers');
const timers = require('timers');
const async = require('async');

const lab = Lab.script();
exports.lab = lab;
const describe = lab.experiment;
const it = lab.it;
const expect = Code.expect;

const db = new PouchDB('todos', {
  db: memdown,
});

const redux = require('redux');

const PouchMiddleware = require('../lib/');

let store;
let pouchMiddleware;

describe('Pouch Redux Middleware', () => {
  it('can be created', done => {
    pouchMiddleware = PouchMiddleware({
      path: '/todos',
      db,
      actions: {
        remove: doc => ({ type: actionTypes.DELETE_TODO, id: doc._id }),
        insert: doc => ({ type: actionTypes.INSERT_TODO, todo: doc }),
        batchInsert: docs => ({
          type: actionTypes.BATCH_INSERT_TODOS,
          todos: docs,
        }),
        update: doc => ({ type: actionTypes.UPDATE_TODO, todo: doc }),
      },
      changeFilter: doc => !doc.filter,
      handleResponse: (error, data, callback) => {
        if (error && error.status === 409) {
          callback();
          return;
        }
        callback(error);
      },
    });
    done();
  });

  it('can be used to create a store', done => {
    const createStoreWithMiddleware = redux.applyMiddleware(pouchMiddleware)(
      redux.createStore
    );
    store = createStoreWithMiddleware(rootReducer);
    done();
  });

  it('accepts a few inserts', done => {
    store.dispatch({ type: actionTypes.ADD_TODO, text: 'do laundry', id: 'a' });
    store.dispatch({
      type: actionTypes.ADD_TODO,
      text: 'wash dishes',
      id: 'b',
    });
    timers.setTimeout(done, 100);
  });

  it('saves changes in pouchdb', done => {
    async.map(['a', 'b'], db.get.bind(db), (err, results) => {
      if (err) return done(err);
      expect(results.length).to.equal(2);
      expect(results[0].text).to.equal('do laundry');
      expect(results[1].text).to.equal('wash dishes');
      done();
    });
  });

  it('accepts an edit', done => {
    store.dispatch({
      type: actionTypes.EDIT_TODO,
      text: 'wash all the dishes',
      id: 'b',
    });
    timers.setTimeout(done, 100);
  });

  it('saves changes in pouchdb', done => {
    async.map(['a', 'b'], db.get.bind(db), (err, results) => {
      if (err) return done(err);
      expect(results.length).to.equal(2);
      expect(results[0].text).to.equal('do laundry');
      expect(results[1].text).to.equal('wash all the dishes');
      done();
    });
  });

  it('accepts an removal', done => {
    store.dispatch({ type: actionTypes.DELETE_TODO, id: 'a' });
    timers.setTimeout(done, 100);
  });

  it('saves changes in pouchdb', done => {
    db.get('a', err => {
      expect(err.message).to.equal('missing');
      done();
    });
  });

  it('making changes in pouchdb...', done => {
    db.get('b', (err, doc) => {
      expect(err).to.equal(null);
      doc.text = 'wash some of the dishes';
      db.put(doc, done);
    });
  });

  it('waiting a bit', done => {
    timers.setTimeout(done, 100);
  });

  it('...propagates update from pouchdb', done => {
    expect(
      store.getState().todos.filter(doc => doc._id === 'b')[0].text
    ).to.equal('wash some of the dishes');
    done();
  });

  it('making removal in pouchdb...', done => {
    db.get('b', (err, doc) => {
      expect(err).to.equal(null);
      db.remove(doc, done);
    });
  });

  it('waiting a bit', done => {
    timers.setTimeout(done, 100);
  });

  it('...propagates update from pouchdb', done => {
    expect(
      store.getState().todos.filter(doc => doc._id === 'b').length
    ).to.equal(0);
    done();
  });

  it('making insert in pouchdb...', done => {
    db.post(
      {
        _id: 'c',
        text: 'pay bills',
      },
      done
    );
  });

  it('waiting a bit', done => {
    timers.setTimeout(done, 100);
  });

  it('...propagates update from pouchdb', done => {
    expect(
      store.getState().todos.filter(doc => doc._id === 'c')[0].text
    ).to.equal('pay bills');
    done();
  });

  it('...inserts filtered document', done => {
    db
      .post({
        _id: 'd',
        filter: true,
      })
      .then(() => done())
      .catch(done);
  });

  it('waiting a bit', done => {
    timers.setTimeout(done, 100);
  });

  it('...filters documents', done => {
    expect(
      store.getState().todos.filter(doc => doc._id === 'd').length
    ).to.equal(0);
    done();
  });

  it('calls initialBatchDispatched', done => {
    const anotherMiddleware = PouchMiddleware({
      path: '/todos',
      db,
      actions: {
        remove: doc => ({ type: actionTypes.DELETE_TODO, id: doc._id }),
        insert: doc => ({ type: actionTypes.INSERT_TODO, todo: doc }),
        batchInsert: docs => ({
          type: actionTypes.BATCH_INSERT_TODOS,
          todos: docs,
        }),
        update: doc => ({ type: actionTypes.UPDATE_TODO, todo: doc }),
      },
      // eslint-disable-next-line consistent-return
      initialBatchDispatched(err) {
        if (err) {
          return done(err);
        }
        /* eslint-disable no-use-before-define */
        let called = false;
        testStore.subscribe(() => {
          if (called) {
            done(new Error('expect subscribe to only be called once'));
          }
          called = true;
          expect(testStore.getState().todos.length).to.equal(1);
          timers.setTimeout(done, 100);
        });

        expect(testStore.getState().todos.length).to.equal(2);
        testStore.dispatch({ type: actionTypes.DELETE_TODO, id: 'c' });
        /* eslint-enable no-use-before-define */
      },
    });
    const testStore = redux.applyMiddleware(anotherMiddleware)(
      redux.createStore
    )(rootReducer);
    expect(testStore.getState().todos.length).to.equal(0);
  });
  it('calls initialBatchDispatched with an error if db.allDocs throws', done => {
    const anotherMiddleware = PouchMiddleware({
      path: '/todos',
      db: { allDocs: () => Promise.reject(new Error('Some PouchDB error')) },
      actions: {
        remove: doc => ({ type: actionTypes.DELETE_TODO, id: doc._id }),
        insert: doc => ({ type: actionTypes.INSERT_TODO, todo: doc }),
        batchInsert: docs => ({
          type: actionTypes.BATCH_INSERT_TODOS,
          todos: docs,
        }),
        update: doc => ({ type: actionTypes.UPDATE_TODO, todo: doc }),
      },
      initialBatchDispatched(err) {
        expect(err).to.equal(new Error('Some PouchDB error'));
        done();
      },
    });
    const testStore = redux.applyMiddleware(anotherMiddleware)(
      redux.createStore
    )(rootReducer);
    expect(testStore.getState().todos.length).to.equal(0);
  });
});
