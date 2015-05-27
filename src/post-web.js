/*
 * post-web
 * https://github.com/qiu8310/post-web
 *
 * Copyright (c) 2015 Zhonglei Qiu
 * Licensed under the MIT license.
 */

process.env.YLOG = (process.env.YLOG ? process.env.YLOG + ',' : '') + 'post:web';

var _ = require('lodash'),
  ylog = require('ylog')('post:web'),
  path = require('path'),
  async = require('async'),

  locate = require('./lib/locate'),
  h = require('./helper');

ylog.attributes.time = true;
ylog.setLevel('info');
ylog.Tag.ns.len = 15;
ylog.Tag.ns.align = 'right';


function postWeb(dir, options) {

  dir = path.resolve(dir);
  process.chdir(dir); // 如果目录不存在，这里会抛出异常，就不需要我去控制了

  var pkg = h.safeReadJson(dir, 'package.json'),
    bkg = h.safeReadJson(dir, 'bower.json'),
    projectName = pkg.name || bkg.name,
    projectVersion = pkg.version || bkg.version;

  if (projectName) {
    ylog.color('green.bold').info('%s %s', projectName, projectVersion);
  }
  ylog.info('project root directory ^%s^', dir);


  // 初始化配置
  options = require('./options')(dir, options);


  // 导入项目下常见文件的数据
  _.assign(options, {
    projectName: projectName,
    projectVersion: projectVersion,
    package: pkg,
    bower: bkg,
    bowerrc: h.safeReadJson(dir, '.bowerrc'),
    gitignore: h.safeReadFileList(dir, '.gitignore')
  });

  var bowerDirectory = options.bowerrc.directory || 'bower_components';
  if (h.isDirectory(bowerDirectory)) {
    options.bowerDirectory = bowerDirectory;  // 大部分插件都需要将这个目录加入 include path
  }


  // 定位每类文件所在的位置，并将其写入 options
  locate(options);


  //
  //
  //switch (options.command) {
  //  case 'clean':
  //    compass(options, cbThrow);
  //    break;
  //  case 'server':
  //    break;
  //  case 'watch':
  //    break;
  //  default :
  //    async.series( wrapTasks([compass, css, image], options), cbThrow );
  //    break;
  //}

  var Styles = require('./tasks/task-styles');
  var styles = new Styles(options);
  styles.compile(function() {

  });
}

postWeb(process.argv[2] || '.', {assetDir: 't'});



module.exports = postWeb;
