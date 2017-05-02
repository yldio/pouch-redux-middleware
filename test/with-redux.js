var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.experiment;
var before = lab.before;
var after = lab.after;
var it = lab.it;
var Code = require('code');
var expect = Code.expect;

var actionTypes = require('./_action_types');
var rootReducer = require('./reducers');

var timers = require('timers');
var async = require('async');
var PouchDB = require('pouchdb');
var db = new PouchDB('todos', {
  db: require('memdown'),
});

var redux = require('redux');

var PouchMiddleware = require('../src/');

describe('Pouch Redux Middleware', function() {
  var pouchMiddleware;
  var store;

  it('can be created', function(done) {
    pouchMiddleware = PouchMiddleware({
      path: '/todos',
      db: db,
      actions: {
        remove: (doc) => { return {type: actionTypes.DELETE_TODO, id: doc._id} },
        insert: (doc) => { return {type: actionTypes.INSERT_TODO, todo: doc} },
        update: (doc) => { return {type: actionTypes.UPDATE_TODO, todo: doc} }
      },
      changeFilter: doc => doc.filter == false
    });
    done();
  });

  it('can be used to create a store', function(done) {
    var createStoreWithMiddleware = redux.applyMiddleware(pouchMiddleware)(redux.createStore);
    store = createStoreWithMiddleware(rootReducer);
    done();
  });

  it('accepts a few inserts', function(done) {
    store.dispatch({type: actionTypes.ADD_TODO, text: 'do laundry', id: 'a'});
    store.dispatch({type: actionTypes.ADD_TODO, text: 'wash dishes', id: 'b'});
    timers.setTimeout(done, 100);
  });

  it('saves changes in pouchdb', function(done) {
    async.map(['a', 'b'], db.get.bind(db), function(err, results) {
      if (err) return done(err);
      expect(results.length).to.equal(2);
      expect(results[0].text).to.equal('do laundry');
      expect(results[1].text).to.equal('wash dishes');
      done();
    });
  });

  it('accepts an edit', function(done) {
    store.dispatch({type: actionTypes.EDIT_TODO, text: 'wash all the dishes', id: 'b'});
    timers.setTimeout(done, 100);
  });

  it('saves changes in pouchdb', function(done) {
    async.map(['a', 'b'], db.get.bind(db), function(err, results) {
      if (err) return done(err);
      expect(results.length).to.equal(2);
      expect(results[0].text).to.equal('do laundry');
      expect(results[1].text).to.equal('wash all the dishes');
      done();
    });
  });

  it('accepts an removal', function(done) {
    store.dispatch({type: actionTypes.DELETE_TODO, id: 'a'});
    timers.setTimeout(done, 100);
  });

  it('saves changes in pouchdb', function(done) {
    db.get('a', function(err) {
      expect(err).to.be.an.object();
      expect(err.message).to.equal('missing');
      done();
    });
  });

  it('making changes in pouchdb...', function(done) {
    db.get('b', function(err, doc) {
      expect(err).to.equal(null);
      doc.text = 'wash some of the dishes';
      db.put(doc, done);
    });
  });

  it('waiting a bit', function(done) {
    timers.setTimeout(done, 100);
  });

  it('...propagates update from pouchdb', function(done) {
    expect(store.getState().todos.filter(function(doc) {
      return doc._id == 'b';
    })[0].text).to.equal('wash some of the dishes');
    done();
  });

  it('making removal in pouchdb...', function(done) {
    db.get('b', function(err, doc) {
      expect(err).to.equal(null);
      db.remove(doc, done);
    });
  });

  it('waiting a bit', function(done) {
    timers.setTimeout(done, 100);
  });

  it('...propagates update from pouchdb', function(done) {
    expect(store.getState().todos.filter(function(doc) {
      return doc._id == 'b';
    }).length).to.equal(0);
    done();
  });

  it('making insert in pouchdb...', function(done) {
    db.post({
      _id: 'c',
      text: 'pay bills',
    }, done);
  });

  it('waiting a bit', function(done) {
    timers.setTimeout(done, 100);
  });

  it('...propagates update from pouchdb', function(done) {
    expect(store.getState().todos.filter(function(doc) {
      return doc._id == 'c';
    })[0].text).to.equal('pay bills');
    done();
  });

  it('...inserts filtered document', function(done) {
    db.post({
      _id: 'd',
      filter: true,
    }).then(() => done()).catch(done);
  });

  it('waiting a bit', function(done) {
    timers.setTimeout(done, 100);
  });

  it('...filters documents', function(done) {
    expect(store.getState().todos.filter(function(doc) {
      return doc._id == 'd';
    }).length).to.equal(0);
    done();
  });

  it('calles initialBatchDispatched', (done) => {
    const anotherMiddleware = PouchMiddleware({
      path: '/todos',
      db: db,
      actions: {
        remove: (doc) => { return {type: actionTypes.DELETE_TODO, id: doc._id} },
        insert: (doc) => { return {type: actionTypes.INSERT_TODO, todo: doc} },
        update: (doc) => { return {type: actionTypes.UPDATE_TODO, todo: doc} }
      },
      initialBatchDispatched(err) {
        if (err) {
          return done(err);
        }

        var called = false;
        store.subscribe(() => {
          if (called) {
            done(new Error('expect subscribe to only be called once'));
          }
          called = true;
          expect(store.getState().todos.length).to.equal(1);
          timers.setTimeout(done, 100);
        });

        expect(store.getState().todos.length).to.equal(2);
        store.dispatch({type: actionTypes.DELETE_TODO, id: 'c'});
      }
    });
    const store = redux.applyMiddleware(anotherMiddleware)(redux.createStore)(rootReducer);
    expect(store.getState().todos.length).to.equal(0);
  });
});
