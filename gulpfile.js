'use strict';

const del = require('del');
const debug = require('gulp-debug');
const eslint = require('gulp-eslint');
const gulp = require('gulp');
const gutil = require('gulp-util');
const livereload = require('gulp-livereload');
const manifest = require('gulp-chrome-manifest');
const runSequence = require('run-sequence');
const size = require('gulp-size');
const webpack = require('webpack');
const zip = require('gulp-zip');

gulp.task('extras', () => {
  return gulp.src([
    'app/*.*',
    'app/_locales/**',
    'app/images/**',
    'app/scripts/lib/bundle.js',
    'app/test/*.*',
    '!app/*.json'
  ], {
    base: 'app',
    dot: true
  })
  .pipe(debug({title: 'copying to dist:'}))
  .pipe(gulp.dest('dist'));
});

gulp.task('lint', () => {
  return gulp.src([
    'app/scripts/**/*.js',
    'app/test/**/*.js',
    '!app/**/bundle.js',

    'gulpfile.js'
  ])
  .pipe(eslint())
  .pipe(eslint.format());
});

gulp.task('manifest', () => {
  let manifestOpts = {
    buildnumber: false,
    background: {
      target: 'scripts/background.js',
      exclude: [
        'scripts/chromereload.js'
      ]
    }
  };
  return gulp.src('app/manifest.json')
  .pipe(manifest(manifestOpts))
  .pipe(gulp.dest('dist'));
});

gulp.task('webpack', (cb) => {
  webpack(require('./webpack.config.js'), function(err, stats) {
    if(err) {
      throw err;
    }
    gutil.log('[webpack]', stats.toString({
      colors: gutil.colors.supportsColor,
      chunks: false,
      chunkModules: false,
      hash: false
    }));
    cb();
  });
});

gulp.task('watch', ['lint', 'webpack'], () => {
  livereload.listen();

  gulp.watch([
    'app/test/bundle.js',
    'app/images/**/*',
    'app/_locales/**/*.json'
  ]).on('change', livereload.reload);

  gulp.watch([
    'app/scripts/**/*.js',
    'app/test/**/*.js',
    '!app/**/bundle.js'
  ], ['lint', 'webpack']);
});

gulp.task('package', function () {
  let manifest = require('./dist/manifest.json');
  return gulp.src('dist/**')
  .pipe(zip('webdriver-extension-' + manifest.version + '.zip'))
  .pipe(gulp.dest('package'));
});

gulp.task('size', () => {
  return gulp.src('dist/**/*').pipe(size({title: 'build', gzip: true}));
});

gulp.task('build', (cb) => {
  runSequence(
    'lint',
    'webpack',
    ['manifest', 'extras'],
    'size', cb);
});

gulp.task('clean', () => {
  return del(['.tmp', 'dist', 'app/**/bundle.js']).then(paths =>
    paths.forEach(path => gutil.log('deleted:', gutil.colors.blue(path)))
  );
});

gulp.task('default', ['clean'], cb => {
  runSequence('build', cb);
});
