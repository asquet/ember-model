module("Plugins.record_unpersistent_deletion#dirty_tracking");

function rud_dt_setup() {
    var app = {};

    app.adapter = Ember.FixtureAdapterExt.create({});

    app.Author = Em.Model.extend({
        name : Em.attr()
    });
    app.Author.adapter = app.adapter;
    app.Author.FIXTURES = [{id:1, name: 'author1'}];
    app.Comment = Em.Model.extend({
        isRequested : true,

        title : Em.attr(),

        author : Em.belongsTo(app.Author, {key : 'authorId'})
    });
    app.Comment.adapter = app.adapter;
    app.Comment.FIXTURES = [{id:1, title: 'c1', authorId: 1}, {id:2, title: 'c2', authorId: 1}];

    app.Post = Em.Model.extend({
        isRequested : true,

        text : Em.attr(),

        comments : Em.hasMany(app.Comment, {key : 'comments'})
    });
    app.Post.adapter = app.adapter;
    app.Post.FIXTURES = [{id:1}];
    app.Post.FIXTURES_HM = {1 : {comments : [1, 2]}};

    return app;
}

test("when no properties have changed on a model, isDirty should be false", function() {
    expect(1);

    var Comment = Em.Model.extend({
        isRequested : true
    });
    var Post = Em.Model.extend({
        isRequested : true,
        comments : Em.hasMany(Comment, {key : 'comments'})
    });


    var obj = Ember.run( Post,  Post.create, {isNew: false});
    ok(!obj.get('isDirty'), 'object with no changes is clean');
});

test("adding and deleting old and new objects in  hasManys sets isDirty correctly", function() {
    expect(6);

    var app = rud_dt_setup();

    var obj =  Ember.run(app.Post, app.Post.find, 1);
    ok(!obj.get('isDirty'), 'object with no changes is clean');

    stop();
    var t = setTimeout(function(){start()}, 1000);
    Em.loadPromise(obj.get('comments')).then(function() {
        ok(!obj.get('isDirty'), 'object is not dirty when hasMany array loads');
        var c = app.Comment.create({});
        obj.get('comments').addObject(c);
        ok(obj.get('isDirty'), 'object gets dirty by adding new child object');
        c.set('isDeleted', true);
        ok(!obj.get('isDirty'), 'object gets clean after deleting new object');

        c = obj.get('comments.firstObject');
        c.set('isDeleted', true);
        ok(obj.get('isDirty'), 'object gets dirty by deleting existing child object');
        c.set('isDeleted', false);
        ok(!obj.get('isDirty'), 'object gets clean by restoring existing child object');

        clearTimeout(t);
        start();
    });
});

test("when one of hasManys gets dirty, parent isDirty should be true", function() {
    expect(2);

    var app = rud_dt_setup();

    var obj = app.Post.find(1);

    stop();
    var t = setTimeout(function(){start()}, 1000);
    Em.loadPromise(obj.get('comments')).then(function() {
        obj.get('comments.firstObject.author');

        var title1 = obj.get('comments.firstObject.title');
        obj.get('comments.firstObject').set('title', 'random');
        ok(obj.get('isDirty'), 'set hasMany.attr - dirty');
        obj.get('comments.firstObject').set('title', title1);
        ok(!obj.get('isDirty'), 'set hasMany.attr back to original - clean');

        clearTimeout(t);
        start();
    });
});

test("reverting record with hasManys", function() {
    expect(4);

    var app = rud_dt_setup();

    var obj = app.Post.find(1);

    stop();
    var t = setTimeout(function(){start()}, 1000);
    Em.loadPromise(obj.get('comments')).then(function() {
        obj.get('comments').pushObject(app.Comment.create({}));
        ok(obj.get('isDirty'), 'adding object to hasMany makes object dirty');

        obj.revert();

        ok(!obj.get('isDirty'), 'revert leaves object clean');

        obj.get('comments.firstObject').set('title', 'asdasd');
        ok(obj.get('isDirty'), 'changing hasMany.attr makes object dirty');

        obj.revert();

        ok(!obj.get('isDirty'), 'revert leaves object clean');

        clearTimeout(t);
        start();
    });
});

test("saving has many makes it clean", function() {
    expect(4);
    var ID = 1;
    var adapter = Em.RESTAdapterExt.extend({
        loadHasMany : function() {
            return [];
        },
        ajax : function() {
            return new Promise(function(resolve) {resolve({id : ID++});});
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

    var post = Post.create({id : 0, isNew : false});

    ok(!post.get('isDirty'), 'object is clean at first');
    post.get('comments').addObject(Comment.create());
    ok(post.get('isDirty'), 'object is dirty after adding object');

    stop();
    post.get('comments').save(function(d) {
        ok(d.id, 'callback called after save');
    }).then(function() {
        ok(!post.get('isDirty'), 'object is clean at last');
        start();
    });
});

test("after saveSequential has many is clean", function() {
    expect(9);
    var ID = 1;
    var sequenceCheck = true;
    var adapter = Em.RESTAdapterExt.extend({
        loadHasMany : function() {
            return [];
        },
        ajax : function() {
            ok(sequenceCheck, 'sequenceCheck is true before creating promise')
            sequenceCheck = false;
            return new Promise(function(resolve) {
                setTimeout(function(){
                    ok(!sequenceCheck, 'sequenceCheck is still false before resolving promise')
                    sequenceCheck = true;
                    resolve({id : ID++});
                }, 200);
            });
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

    var post = Post.create({id : 0, isNew : false});

    ok(!post.get('isDirty'), 'object is clean at first');
    post.get('comments').addObject(Comment.create());
    post.get('comments').addObject(Comment.create());
    ok(post.get('isDirty'), 'object is dirty after adding object');

    stop();
    post.get('comments').saveSequential(function(d) {
        ok(d.id, 'callback called after save of each object (2 objects=2 calls)');
    }).then(function() {
        ok(!post.get('isDirty'), 'object is clean at last');
        start();
    });
});