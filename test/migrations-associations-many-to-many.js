'use strict';

var fire = require('..');

var Migrations = require('./../lib/modules/migrations');
var assert = require('assert');
var Q = require('q');

describe('migrations-associations-many-to-many', function() {
    var app = null;
	var models = null;
    var migrations = null;

    afterEach(function(done) {
        migrations.destroyAllModels()
        .then(function() {
            return app.stop();
        })
        .then(function() {
            done();
        })
        .catch(function(error) {
            done(error);
        })
        .done();
    });

    beforeEach(function(done) {
        app = fire.app('migrations', {});
        app.start()
            .then(function() {
                models = app.models;

                migrations = new Migrations();
                migrations.setup(null, models)
                    .then(function() {
                        return models.Schema.removeAll();
                    })
                    .then(function() {
                        done();
                    })
                    .catch(function(error) {
                        done(error);
                    })
                    .done();
            })
            .catch(function(error) {
                done(error);
            })
    });

    it('can create model with multiple associations', function() {
        function Migration() {
            //
        }

        Migration.prototype.up = function() {
            this.models.createModel('User', {
                id: [this.UUID],
                name: [this.String, this.Required],
                articles: [this.HasMany(this.models.Article, "submitter")],
                votes: [this.HasMany(this.models.Article, "voters")],
                comments: [this.HasMany(this.models.Comment)]
            });
            this.models.createModel('Article', {
                id: [this.UUID],
                title: [this.String, this.Required],
                url: [this.String, this.Required],
                createdAt: [this.DateTime, this.Default("CURRENT_DATE")],
                submitter: [this.BelongsTo(this.models.User, "articles"), this.Required, this.AutoFetch],
                voters: [this.HasMany(this.models.User, "votes"), this.AutoFetch],
                comments: [this.HasMany(this.models.Comment), this.AutoFetch]
            });
            this.models.createModel('Comment', {
                id: [this.UUID],
                article: [this.BelongsTo(this.models.Article)],
                author: [this.BelongsTo(this.models.User), this.AutoFetch],
                text: [this.String, this.Required]
            });
        };

        Migration.prototype.down = function() {
            this.models.destroyModel('User');
            this.models.destroyModel('Article');
            this.models.destroyModel('Comment');
        };

        migrations.addMigration(Migration, 1);
        return migrations.migrate(0, 1)
            .then(function() {
                assert.notEqual(models.ArticleVoterUserVote, null);
                return models.ArticleVoterUserVote.exists();
            })
            .then(function(exists) {
                assert.equal(exists, true);

                return Q.all([
                    models.User.create({name: 'Test 1'}),
                    models.User.create({name: 'Test 2'})
                ]);
            })
            .spread(function(user1, user2) {
                return models.Article.create({title: 'Test', url: 'https://github.com/martijndeh/fire', submitter: user1})
                    .then(function(article) {
                        return article.addVoter(user2)
                            .then(function() {
                                return models.Comment.create({article: article, author: user2, text: 'This is a comment!'});
                            });
                    });
            })
            .then(function() {
                return models.Article.findOne();
            })
            .then(function(article) {
                assert.notEqual(article, null);
                assert.equal(article.title, 'Test');

                assert.equal(article.submitter.name, 'Test 1');
                assert.equal(article.voters.length, 1);
                assert.equal(article.comments.length, 1);

                var comment = article.comments[0];
                assert.equal(comment.author.name, 'Test 2');
                assert.equal(comment.text, 'This is a comment!');

                var voter = article.voters[0];
                assert.equal(voter.name, 'Test 2');
            });
    });

    it('can create model with M:N association', function(done) {
    	function Migration() {}
        Migration.prototype.up = function() {
            this.models.createModel('A', {
                id: [this.UUID],
                name: [this.String],
                bs: [this.HasMany(this.models.B)]
            });

            this.models.createModel('B', {
                id: [this.UUID],
                name: [this.String],
                as: [this.HasMany(this.models.A)]
            });
        };
        Migration.prototype.down = function() {
            this.models.destroyModel('A');
            this.models.destroyModel('B');
        };

        migrations.addMigration(Migration, 1);
        migrations.migrate(0, 1)
            .then(function() {
                done();
            })
            .catch(function(error) {
                done(error);
            });
    });

    it('can create instances with M:N association', function(done) {
        function Migration() {}
        Migration.prototype.up = function() {
            this.models.createModel('A', {
                id: [this.UUID],
                name: [this.String],
                bs: [this.HasMany(this.models.B)]
            });

            this.models.createModel('B', {
                id: [this.UUID],
                name: [this.String],
                as: [this.HasMany(this.models.A)]
            });
        };
        Migration.prototype.down = function() {
            this.models.destroyModel('A');
            this.models.destroyModel('B');
        };

        migrations.addMigration(Migration, 1);
        migrations.migrate(0, 1)
            .then(function() {
                return models.A.create({
                    name: 'Aart'
                });
            })
            .then(function(a) {
                assert.equal(a.name, 'Aart');
                assert.equal(typeof a.getBs, 'function');
                assert.equal(typeof a.getB, 'function');
                assert.equal(typeof a.bs, 'undefined');
                assert.equal(typeof a.addB, 'function');
                assert.equal(typeof a.removeB, 'function');

                return models.B
                    .create({
                        name: 'Bert'
                    })
                    .then(function(b) {
                        assert.equal(b.name, 'Bert');
                        assert.equal(typeof b.getAs, 'function');
                        assert.equal(typeof b.getA, 'function');
                        assert.equal(typeof b.as, 'undefined');
                        assert.equal(typeof b.addA, 'function');
                        assert.equal(typeof b.removeA, 'function');

                        return b.addA(a)
                            .then(function(association) {
                                assert.notEqual(association, null);

                                return b.getAs();
                            })
                            .then(function(as) {
                                assert.notEqual(as, null);
                                assert.equal(as.length, 1);

                                return b.removeA(a);
                            })
                            .then(function() {
                                return b.getAs();
                            })
                            .then(function(as) {
                                assert.notEqual(as, null);
                                assert.equal(as.length, 0);

                                return a.addB(b);
                            })
                            .then(function(association) {
                                assert.notEqual(association, null);
                                return a.getBs();
                            })
                            .then(function(bs) {
                                assert.notEqual(bs, null);
                                assert.equal(bs.length, 1);
                                return true;
                            });
                    });
            })
            .then(function() {
                done();
            })
            .catch(function(error) {
                done(error);
            });
    });

    it('can create M:N relationships with unrelated names', function(done) {
        function Migration() {}
        Migration.prototype.up = function() {
            this.models.createModel('A', {
                id: [this.UUID],
                name: [this.String],
                manyKey1: [this.HasMany(this.models.B)]
            });

            this.models.createModel('B', {
                id: [this.UUID],
                name: [this.String],
                manyKey2: [this.HasMany(this.models.A)]
            });
        };
        Migration.prototype.down = function() {
            this.models.destroyModel('A');
            this.models.destroyModel('B');
        };

        migrations.addMigration(Migration, 1);
        migrations.migrate(0, 1)
            .then(function() {
                return models.A.create({
                    name: 'Aart'
                });
            })
            .then(function(a) {
                assert.equal(a.name, 'Aart');
                assert.equal(typeof a.getManyKey1s, 'function');
                assert.equal(typeof a.manyKey1, 'undefined');
                assert.equal(typeof a.manyKey1s, 'undefined');
                assert.equal(typeof a.addManyKey1, 'function');
                assert.equal(typeof a.removeManyKey1, 'function');

                return models.B
                    .create({
                        name: 'Bert'
                    })
                    .then(function(b) {
                        assert.equal(b.name, 'Bert');
                        assert.equal(typeof b.getManyKey2s, 'function');
                        assert.equal(typeof b.manyKey2, 'undefined');
                        assert.equal(typeof b.manyKey2s, 'undefined');
                        assert.equal(typeof b.addManyKey2, 'function');
                        assert.equal(typeof b.removeManyKey2, 'function');

                        return b.addManyKey2(a)
                            .then(function(association) {
                                assert.notEqual(association, null);

                                return b.getManyKey2s();
                            })
                            .then(function(as) {
                                assert.notEqual(as, null);
                                assert.equal(as.length, 1);
                                assert.equal(as[0].name, 'Aart');

                                return b.removeManyKey2(a);
                            })
                            .then(function(association) {
                                return b.getManyKey2s();
                            })
                            .then(function(as) {
                                assert.notEqual(as, null);
                                assert.equal(as.length, 0);

                                return a.addManyKey1(b);
                            })
                            .then(function(association) {
                                assert.notEqual(association, null);
                                return a.getManyKey1s();
                            })
                            .then(function(bs) {
                                assert.notEqual(bs, null);
                                assert.equal(bs.length, 1);
                                assert.equal(bs[0].name, 'Bert');
                                return true;
                            });
                    });
            })
            .then(function() {
                done();
            })
            .catch(function(error) {
                done(error);
            })
            .done();
    });

    it('cannot add invalid associations', function(done) {
        function Migration() {}
        Migration.prototype.up = function() {
            this.models.createModel('A', {
                id: [this.UUID],
                name: [this.String],
                bs: [this.HasMany(this.models.B)]
            });

            this.models.createModel('B', {
                id: [this.UUID],
                name: [this.String],
                as: [this.HasMany(this.models.A)]
            });
        };
        Migration.prototype.down = function() {
            this.models.destroyModel('A');
            this.models.destroyModel('B');
        };

        migrations.addMigration(Migration, 1);
        migrations.migrate(0, 1)
            .then(function() {
                return models.A.create({
                    name: 'Aart'
                });
            })
            .then(function(a) {
                return models.B
                    .create({
                        name: 'Bert'
                    })
                    .then(function(b) {
                        b.addA({id:123})
                            .then(function() {
                                // This should happen ... obviously
                                assert.equal(1, 2);
                            })
                            .catch(function(error) {
                                assert.notEqual(error, null);
                            })
                            .then(function() {
                                return b.getAs()
                            })
                            .then(function(as) {
                                assert.equal(as.length, 0);
                                return true;
                            })
                    });
            })
            .then(function() {
                done();
            })
            .catch(function(error) {
                done(error);
            })
            .done();
    });

    it('can query relationships with find', function(done) {
        function Migration() {}
        Migration.prototype.up = function() {
            this.models.createModel('A', {
                id: [this.UUID],
                name: [this.String],
                bs: [this.HasMany(this.models.B)]
            });

            this.models.createModel('B', {
                id: [this.UUID],
                name: [this.String],
                as: [this.HasMany(this.models.A)]
            });
        };
        Migration.prototype.down = function() {
            this.models.destroyModel('A');
            this.models.destroyModel('B');
        };

        var names = [
            'Aart 1',
            'Aart 2',
            'Aart 3',
            'Aart 4',
            'Aart 5',
            'Adrian 1',
            'Adrian 2',
            'Adrian 3',
            'Adrian 4',
            'Adrian 5',
        ];

        migrations.addMigration(Migration, 1);
        migrations.migrate(0, 1)
            .then(function() {
                var result = Q.when(true);

                names.forEach(function(name) {
                    result = result.then(function() {
                        return models.A.create({name: name});
                    });
                });

                return result;
            })
            .spread(function(a1, a2, a3, a4, a5, a6, a7, a8, a9, a10) {
                return models.B
                    .create({
                        name: 'Bert'
                    })
                    .then(function(b) {
                        var result = Q.when(true);

                        result = result.then(function() { return b.addA(models.A.findOne({name:names[0]})); });
                        result = result.then(function() { return b.addA(models.A.findOne({name:names[1]})); });
                        result = result.then(function() { return b.addA(models.A.findOne({name:names[2]})); });
                        result = result.then(function() { return b.addA(models.A.findOne({name:names[3]})); });
                        result = result.then(function() { return b.addA(models.A.findOne({name:names[4]})); });
                        result = result.then(function() { return b.addA(models.A.findOne({name:names[5]})); });
                        result = result.then(function() { return b.addA(models.A.findOne({name:names[6]})); });
                        result = result.then(function() { return b.addA(models.A.findOne({name:names[7]})); });
                        result = result.then(function() { return b.addA(models.A.findOne({name:names[8]})); });
                        result = result.then(function() { return b.addA(models.A.findOne({name:names[9]})); });

                        return result.then(function() {
                            return b.getAs();
                        });
                    });
            })
            .then(function(as) {
                assert.equal(as.length, 10);
                done();
            })
            .catch(function(error) {
                done(error);
            })
            .done();
    });

    it('can create model with M:N association using different names', function(done) {
        function Migration() {}
        Migration.prototype.up = function() {
            this.models.createModel('C', {
                id: [this.UUID],
                name: [this.String],
                ds: [this.HasMany(this.models.D)]
            });

            this.models.createModel('D', {
                id: [this.UUID],
                name: [this.String],
                cs: [this.HasMany(this.models.C)]
            });
        };
        Migration.prototype.down = function() {
            this.models.destroyModel('C');
            this.models.destroyModel('D');
        };

        migrations.addMigration(Migration, 1);
        migrations.migrate(0, 1)
            .then(function() {
                return models.C.create({
                    name: 'Cees'
                });
            })
            .then(function(c) {
                assert.equal(c.name, 'Cees');

                return models.D
                    .create({
                        name: 'Dirk'
                    })
                    .then(function(d) {
                        assert.equal(d.name, 'Dirk');

                        return d.addC(c)
                            .then(function(association) {
                                assert.notEqual(association, null);

                                return d.getCs();
                            })
                            .then(function(cs) {
                                assert.notEqual(cs, null);
                                assert.equal(cs.length, 1);

                                return d.removeC(c);
                            })
                            .then(function(association) {
                                return d.getCs();
                            })
                            .then(function(cs) {
                                assert.notEqual(cs, null);
                                assert.equal(cs.length, 0);

                                return c.addD(d);
                            })
                            .then(function(association) {
                                assert.notEqual(association, null);
                                return c.getDs();
                            })
                            .then(function(ds) {
                                assert.notEqual(ds, null);
                                assert.equal(ds.length, 1);
                                return true;
                            });
                    });
            })
            .then(function() {
                done();
            })
            .catch(function(error) {
                done(error);
            });
    });
});
