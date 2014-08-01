module("Plugins.rest_adapter_ext",{
    setup: function () {
        if (App) App.reset();
    }
});

test("it exists", function () {
    var a = Ember.RESTAdapterExt.create({});
    ok(a.callRestOnObject);
    ok(a.callRestOnClass);
});

test("Model.callRestOnClass - correct request goes to ajax", function () {
    expect(3);

    var MyModel = Em.Model.extend();
    MyModel.url = "model";
    MyModel.adapter = Ember.RESTAdapterExt.extend({
        ajax: function (url, params, method, settings) {
            var p = new Em.RSVP.Promise(function (resolve) {
                resolve({
                    url: url,
                    params: params,
                    method: method,
                    settings: settings
                });
            });
            return p;
        }
    }).create();
    stop();
    MyModel.callRestOnClass('action', 'POST', {test:'passed'}).then(function (params) {
        start();
        equal(params.url, 'rest/model/action');
        equal(params.method, 'POST');
        equal(params.params.test, 'passed');
    });

});

test("Model.callRestOnObject - correct request goes to ajax", function () {
    expect(3);

    var MyModel = Em.Model.extend();
    MyModel.url = "model";
    MyModel.adapter = Ember.RESTAdapterExt.extend({
        ajax: function (url, params, method, settings) {
            var p = new Em.RSVP.Promise(function (resolve) {
                resolve({
                    url: url,
                    params: params,
                    method: method,
                    settings: settings
                });
            });
            return p;
        }
    }).create();

    var model = MyModel.create({id : 1});
    stop();
    model.callRestOnObject('action', 'POST', {test:'passed'}).then(function (params) {
        equal(params.url, 'rest/model/1/action');
        equal(params.method, 'POST');
        equal(params.params.test, 'passed');
        start();
    });

});

test('AdapterExt.deleteRecord - do not call ajax for delete of new records', function() {
    expect(0);
    var MyModel = Em.Model.extend();
    MyModel.url = "model";
    MyModel.adapter = Ember.RESTAdapterExt.extend({
        ajax: function (url, params, method, settings) {
            notEqual('adapter.ajax should not be called', 'but here it is called');
        }
    }).create();

    var model = MyModel.create();

    model.deleteRecord();
});

//adapter.deleteRecord - call ajax for non-new objects

//adapter.findMany

//adapter.buildURL

//adapter.loadHasMany