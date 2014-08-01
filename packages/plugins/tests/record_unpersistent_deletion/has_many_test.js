module("Plugins.record_unpersistent_deletion#has_many");

test('get hasMany correctly requests data. checked with loadPromise', function() {
    expect(4);

    var adapter = Ember.Adapter.extend({
        namespace : 'rest',
        loadHasMany : function(record, propName, type, collection) {
            var url = this.namespace + "/" +
                record.constructor.getDefaultRestUrl() + "/" +
                record.get('id') + "/" + propName;
            equal('rest/posts/1/comments', url, 'url for requesting formed');

            Em.run.later(this,function() {
                var response = [{id : 1}, {id: 2}];
                Ember.run(collection, collection.loadData, type, response);
                collection.notifyLoaded();
            }, 500);

            return [];
        }

    }).create();

    var App = Em.Application.create({});

    App.Comment = Em.Model.extend({
        isRequested : true
    });
    App.Comment.adapter = adapter;
    App.Post = Em.Model.extend({
        isRequested : true,
        comments : Em.hasMany(App.Comment, {key : 'comments'})
    });
    App.Post.adapter = adapter;

    var post = App.Post.create({id:1});

    stop(2);
    post.addObserver('comments.[]', function(){
        ok(post.get('comments.length'), 'loading hasMany pokes observer');
        start();
    });
    Em.loadPromise(post.get('comments')).then(function(data) {
        deepEqual([1, 2], post.get('comments').mapBy('id'), 'data received from hasMany is all right');
        QUnit.start();
    });

    equal(post.get('comments.constructor').toString(), 'Ember.DeletableHasManyArray', 'hasMany array is of correct type');
});

test('get hasMany does not count records with isDeleted===true', function() {
    expect(3);

    var adapter = Ember.Adapter.extend({
        namespace : 'rest',
        loadHasMany : function(record, propName, type, collection) {
            var url = this.namespace + "/" +
                record.constructor.getDefaultRestUrl() + "/" +
                record.get('id') + "/" + propName;

            Em.run.later(this,function() {
                var response = [{id : 1}, {id: 2}];
                Ember.run(collection, collection.loadData, type, response);
                collection.notifyLoaded();
            }, 500);

            return [];
        }

    }).create();

    var Comment = Em.Model.extend({
        isRequested : true
    });
    Comment.adapter = adapter;
    var Post = Em.Model.extend({
        isRequested : true,
        comments : Em.hasMany(Comment, {key : 'comments'})
    });
    Post.adapter = adapter;

    var post = Post.create({id:1});

    stop();
    Em.loadPromise(post.get('comments')).then(function(data) {
        equal(post.get('comments.length'), 2);
        var o = post.get('comments.firstObject');
        o.set('isDeleted', true);
        equal(post.get('comments.length'), 1);
        o.set('isDeleted', false);
        equal(post.get('comments.length'), 2);

        QUnit.start();
    });
});