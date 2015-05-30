/*
 * post-web
 * https://github.com/qiu8310/post-web
 *
 * Copyright (c) 2015 Zhonglei Qiu
 * Licensed under the MIT license.
 */
var ylog = require('ylog')('post:control'),
  _ = require('lodash'),
  async = require('async'),
  path = require('path'),
  watch = require('./lib/watch');

var EventEmitter = require('events').EventEmitter,
  util = require('util');

function TaskControl(options) {
  EventEmitter.call(this);

  var orders = {
    styles: 9,
    scripts: 8,
    templates: 7,
    images: 5,
    fonts: 4,
    others: 1
  };

  var enabledTaskNames = Object.keys(options.dist)
    .sort(function(a, b) { return orders[b] - orders[a]; });


  var tasks = [];

  enabledTaskNames.forEach(function(taskName) {

    ylog.ln.info.title('initializing task %s', taskName);

    var C = require('./tasks/task-' + taskName),
      task = new C(taskName, options);

    tasks.push(task);

    task.compileWrap = function(done) {
      ylog.info.ln.title('compiling task %s', task.name);
      task.isCompiling = true;
      task.compile(function(err) {
        if (!err) { ylog.ok('compiled task @%s@ ', task.name); }
        task.isCompiling = false;
        done(err);
      });
    };

    ylog.silly('task @%s@ options', taskName, task.taskOpts);
    ylog.ok('initialized task @%s@', taskName);
  });

  this.options = options;
  this.tasks = tasks;
}

util.inherits(TaskControl, EventEmitter);

_.assign(TaskControl.prototype, {
  compile: function(done) {
    async.eachSeries(
      this.tasks,
      function(task, done) {
        // 如果正在编译没必要执行（有些编译可能会修改源代码）
        if (task.isCompiling || (task.watchedFiles && !task.watchedFiles.length)) {
          done();
        } else {
          if (task.hasFileAdd) {
            task.locate(); // 如果有文件添加需要更新下文件索引
          }
          task.compileWrap(done);
        }
      },
      done
    );
  },

  /**
   * 监听 assetDir 中的所有文件的变化，如果有变化，启动编译
   *
   * @param {Object} opts
   * @param {Number} opts.interval
   * @param {Number} opts.debounceDelay
   */
  watch: function(opts) {
    var self = this;
    ylog.info.ln.title('watch directory %s', this.options.assetDir);
    ylog.debug('watch options', opts);

    watch(this.options.assetDir, opts, function(files) {
      // files 是一个数组：[[event, filepath], ... ]

      _.each(self.tasks, function(task) {
        task.watchedFiles = [];
        task.hasFileAdd = false;
      });

      // 判断更新的文件是在哪个位置：styles? scripts? templates? images?
      files.forEach(function(it) {
        var event = it[0], file = it[1], task;
        // 文件删除了没必要重新编译
        if (event !== 'deleted') {
          task = _.find(self.tasks, function(t) { return t.includesFile(file); });
          if (task) {
            task.watchedFiles.push(file);
            task.hasFileAdd = true;
          }
        }
      });

      self.compile();
    });
  },

  /**
   * 触发浏览器自动刷新
   * @param {Array.<String>} files
   */
  livereload: function(files) {
    if (this.lr) {
      this.lr.trigger([].concat(files));
    }
  },

  /**
   * 启动 web 和 livereload 服务器
   *
   * @param {Object} opts
   * @param {Number} opts.port        - 指定 web 服务器端口，默认 9000
   * @param {Number} opts.livereload  - 指定 livereload 服务器端口，默认 35729，
   *                                    如果不想使用 livereload，可以将它设置成 false
   *
   * @param {String} opts.host        - 指定 web 服务器 host，默认 0.0.0.0
   * @param {String} opts.protocol    - 指定 web 服务器协议，默认 http
   * @param {Object} opts.watch       - watch 用的选项，有 interval 和 debounceDelay
   *
   * 注意，指定的 port 和 livereload 的端口可能会被使用，如果被使用了，
   *      服务器会自动定位到一个没使用的端口，所以你想要确认最新的端口是什么时，
   *      可以使用 modifiedOpts 中的 port 和 livereload 中的值
   */
  server: function(opts) {
    var self = this;

    ylog.info.ln.title('start server');
    ylog.debug('server options', opts);

    ylog.info('watch directory ^%s^', this.options.distDir);
    watch(this.options.distDir, opts && opts.watch, function(files) {
      self.livereload(files.map(function(item) {
        return path.relative('.', item[1]);
      }));
    });

    require('./server/express-app')(opts, function(app, modifiedOpts) {

      self.lr = app.lr;
      this.modRewrite = require('connect-modrewrite');

      self.options.server.call(this, app, modifiedOpts, self.options);

      /*
       Url Rewrite Example:

       // http://x.com/a/b/c/styles/spring => http://x.com/spring.html
       '^/(?:[\\w\\/]+\\/)?(' + APPS.join('|') + ')([^\\.]*)$ /$1.html [L]',

       // http://x.com/a/b/c/styles/spring.css => http://x.com/styles/spring.css
       '^.*?(styles|images|scripts|views)(\\/.*)$ /$1$2 [L]'
       */

      //app.use(this.modRewrite([ '^/static/(.*) /$1' ]));


      // 这个放在最后，因为此 middle ware 是会终止的，不会继续向下执行
      // this === require('express')
      app.use(this.static(self.options.distDir));
      app.use(this.static(self.options.assetDir));  // 以免有些文件没有移进来


      // 也可以加上前缀
      // app.use('/static', express.static('public'));

    });
  }
});

module.exports = TaskControl;
