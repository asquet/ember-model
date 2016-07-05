module("Plugins.model_with_rest_attrs");

test("it exists", function () {
    ok(Ember.Model.makeLoadableProp);
    ok(Ember.Model.makeLoadableArrayProp);
});

test("makeLoadableProp - created, requested, transformed and pocked observer", function () {
    expect(1);

    var MyModel = Em.Model.extend({
        loadable: Em.Model.makeLoadableProp('loadable', 'loadable_path', function (result) {
            return result + " and then transformed";
        })
    });
    MyModel.url = "model";
    MyModel.adapter = Ember.RESTAdapterExt.extend({
        callRestOnObject: function (record, action, method, data, settings) {
            return new Em.RSVP.Promise(function (resolve) {
                resolve(action + ' requested correctly');
            });
        }
    }).create();

    var obj = MyModel.create({
        id: 1
    });
    stop();
    var t = setTimeout(function () {
        start()
    }, 650);
    Em.addObserver(obj, 'loadable', function () {
        equal(obj.get('loadable'), 'loadable_path requested correctly and then transformed');
        clearTimeout(t);
        start();
    });
    obj.get('loadable');
});

test("makeLoadableProp - created volatile, requested, transformed and pocked observer", function() {
    expect(1);

    var MyModel = Em.Model.extend({
        loadable: Em.Model.makeLoadableProp('loadable', 'loadable_path', function (result) {
            return result + " and then transformed";
        }).volatile()
    });
    MyModel.url = "model";
    MyModel.adapter = Ember.RESTAdapterExt.extend({
        callRestOnObject: function (record, action, method, data, settings) {
            return new Em.RSVP.Promise(function (resolve) {
                resolve(action + ' requested correctly');
            });
        }
    }).create();

    var obj = MyModel.create({
        id: 1
    });
    stop();
    var t = setTimeout(function () {
        start()
    }, 650);
    Em.addObserver(obj, 'loadable', function () {
        equal(obj.get('loadable'), 'loadable_path requested correctly and then transformed');
        clearTimeout(t);
        start();
    });
    obj.get('loadable');
});

test("makeLoadableArrayProp - requested, transformed and pocked observer", function () {
    expect(4);

    var MyModel = Em.Model.extend({
        loadable: Em.Model.makeLoadableArrayProp('loadable', 'loadable_path', function (i, result) {
            result.t = i + " in order";
            return result;
        })
    });
    MyModel.url = "model";
    MyModel.adapter = Ember.RESTAdapterExt.extend({
        callRestOnObject: function (record, action, method, data, settings) {
            var p = new Em.RSVP.Promise(function (resolve) {
                resolve([{d: action + ' requested correctly'}, {d: 'op op'}]);
            });
            return p;
        }
    }).create();

    var obj = MyModel.create({
        id: 1
    });
    stop();
    var t = setTimeout(function () {
        start()
    }, 650);
    Em.addObserver(obj, 'loadable.@each', function () {
        if (obj.get('loadable.length')) {
            equal(obj.get('loadable.firstObject.d'), 'loadable_path requested correctly');
            equal(obj.get('loadable.firstObject.t'), '0 in order');

            equal(obj.get('loadable.lastObject.d'), 'op op');
            equal(obj.get('loadable.lastObject.t'), '1 in order');
            clearTimeout(t);
            start();
        }
    });
    obj.get('loadable');

});

test("reloadProp - refreshes value", function () {
    expect(2);

    var MyModel = Em.Model.extend({
        loadable: Em.Model.makeLoadableProp('loadable', 'loadable_path')
    });
    MyModel.url = "model";

    var count1 = 0,
        count2 = 0;
    MyModel.adapter = Ember.RESTAdapterExt.extend({
        callRestOnObject: function (record, action, method, data, settings) {
            var p = new Em.RSVP.Promise(function (resolve) {
                count1++;
                resolve(count1);
            });
            return p;
        }
    }).create();


    var obj = MyModel.create({
        id: 1
    });
    stop();
    var t = setTimeout(function () {
        start();
    }, 650);

    obj.get('loadable');
    count2++;
    Ember.run.later(function() {
        obj.reloadProp('loadable').then(function () {
            count2++;
            equal(obj.get('loadable'), count2, 'value loaded correctly');
            obj.reloadProp('loadable').then(function () {
                count2++;
                equal(obj.get('loadable'), count2, 'value loaded correctly');
                clearTimeout(t);
                start();
            });
        });
    });
});

test("reloadProp - array - refreshes value", function () {
    expect(2);

    var MyModel = Em.Model.extend({
        loadable: Em.Model.makeLoadableArrayProp('loadable', 'loadable_path')
    });
    MyModel.url = "model";

    var count1 = 0,
        count2 = 0;
    MyModel.adapter = Ember.RESTAdapterExt.extend({
        callRestOnObject: function (record, action, method, data, settings) {
            return new Em.RSVP.Promise(function (resolve) {
                count1++;
                resolve([{val: count1}]);
            });
        }
    }).create();


    var obj = MyModel.create({
        id: 1
    });
    stop();
    var t = setTimeout(function () {
        start();
    }, 650);

    obj.get('loadable');
    count2++;
    Em.run.later(function () {
        obj.reloadProp('loadable').then(function () {
            count2++;
            equal(obj.get('loadable.firstObject.val'), count2, 'value loaded correctly');

            obj.reloadProp('loadable').then(function () {
                count2++;
                equal(obj.get('loadable.firstObject.val'), count2, 'value loaded correctly');
                clearTimeout(t);
                start();
            });
        });
    });

});
