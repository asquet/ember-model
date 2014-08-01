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

test("when new record added to hasManys, isDirty should be true", function() {
    expect(3);

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