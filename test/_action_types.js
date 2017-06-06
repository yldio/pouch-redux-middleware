'use strict';

[
  'ERROR',
  'ADD_TODO',
  'INSERT_TODO',
  'BATCH_INSERT_TODOS',
  'DELETE_TODO',
  'EDIT_TODO',
  'UPDATE_TODO',
  'COMPLETE_TODO',
  'COMPLETE_ALL',
  'CLEAR_COMPLETED',
].forEach(type => {
  exports[type] = type;
});
