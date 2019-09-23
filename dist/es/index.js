import 'array.from';
import save from './save';

export var SET_REDUCER = 'redux-pouchdb/SET_REDUCER';
export var INIT = '@@redux-pouchdb/INIT';

var LOCAL_IDENTIFIER = Array(12).fill(0).map(function (_) {
  return String.fromCharCode(function (x) {
    return x > 25 ? x + 71 : x + 65;
  }(Math.floor(Math.random() * 52)));
}).join('');

var saveReducer = void 0;
var isInitialized = false;
export var persistentStore = function persistentStore(db) {
  var onChange = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
  return function (storeCreator) {
    return function (reducer, initialState) {

      var store = storeCreator(reducer, initialState);

      saveReducer = save(db, LOCAL_IDENTIFIER);

      if (!Array.isArray(onChange)) {
        onChange = [onChange];
      }

      var setReducer = function setReducer(doc) {
        var _id = doc._id,
            _rev = doc._rev,
            state = doc.state;


        store.dispatch({
          type: SET_REDUCER,
          reducer: _id,
          state: state,
          _rev: _rev
        });

        onChange.forEach(function (fn) {
          var result = fn(doc);
          if (result) {
            store.dispatch(result);
          }
        });
      };

      db.allDocs({ include_docs: true }).then(function (res) {
        var promises = res.rows.map(function (row) {
          return setReducer(row.doc);
        });
        return Promise.all(promises);
      }).then(function () {
        isInitialized = true;
        store.dispatch({
          type: INIT
        });

        return db.changes({
          include_docs: true,
          live: true,
          since: 'now'
        }).on('change', function (change) {
          if (change.doc.state && change.doc.madeBy !== LOCAL_IDENTIFIER) {
            setReducer(change.doc);
          }
        });
      }).catch(console.error.bind(console));

      return store;
    };
  };
};

export var persistentReducer = function persistentReducer(reducer, name) {
  var lastState = void 0;
  name = name || reducer.name || Math.random().toString();

  return function (state, action) {
    if (action.type === SET_REDUCER && action.reducer === name && action.state) {

      lastState = action.state;
      return reducer(action.state, action);
    }
    if (action.type === SET_REDUCER) {
      // Another reducer's state... ignore.
      return state;
    }

    var reducedState = reducer(state, action);
    if (isInitialized && reducedState !== lastState) {
      lastState = reducedState;
      saveReducer(name, reducedState);
    }

    return reducedState;
  };
};