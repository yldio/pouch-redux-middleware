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

var PouchMiddleware = require('../');

describe('Pouch Redux Middleware', function() {
  var pouchMiddleware;
  var store;

  it('can be created', function(done) {
    pouchMiddleware = PouchMiddleware({
      path: '/todos',
      db: db,
      actions: {
        remove: doc => store.dispatch({type: actionTypes.DELETE_TODO, id: doc._id}),
        insert: doc => store.dispatch({type: actionTypes.INSERT_TODO, todo: doc}),
        update: doc => store.dispatch({type: actionTypes.UPDATE_TODO, todo: doc}),
      }
    });
    done();
  });

  it('can be used to create a store', function(done) {
    var createStoreWithMiddleware = redux.applyMiddleware(pouchMiddleware)(redux.createStore);
    store = createStoreWithMiddleware(rootReducer);
    done();
  });

  it('accepts a few changes', function(done) {
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

  it('accepts a few more changes', function(done) {
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

});
