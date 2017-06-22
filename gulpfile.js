'use strict';

const del = require('del');
const debug = require('gulp-debug');
const eslint = require('gulp-eslint');
const gulp = require('gulp');
const gutil = require('gulp-util');
const livereload = require('gulp-livereload');
const manifest = require('gulp-chrome-manifest');
const runSequence = require('run-sequence');
const webpack = require('webpack');
const zip = require('gulp-zip');

gulp.task('lint', () => {
  return gulp.src([
    'app/src/**/*.js',
    'app/test/**/*.js',
    '!app/test/web/**',
    'gulpfile.js'
  ])
  .pipe(eslint())
  .pipe(eslint.format());
});

gulp.task('webpack', (cb) => {
  webpack(require('./webpack.config.js'), (err, stats) => {
    if (err) {
      throw err;
    }

    gutil.log('[webpack]', stats.toString({
      colors: gutil.colors.supportsColor
    }));

    cb();
  });
});

gulp.task('scripts', ['webpack'], () => {
  return gulp.src('app/src/*.js')
    .pipe(gulp.dest('app/scripts'));
});

gulp.task('watch', ['lint', 'scripts'], () => {
  livereload.listen();

  gulp.watch([
    'app/scripts/**/*.js',
    'app/images/**/*',
    'app/_locales/**/*.json'
  ]).on('change', livereload.reload);

  gulp.watch([
    'app/src/**/*.js',
    'app/test/**/*.js'
  ], ['lint', 'scripts']);
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

gulp.task('extras', () => {
  return gulp.src([
    'app/*',
    'app/_locales/**',
    'app/images/**',
    'app/scripts/*',
    'app/test/*',
    '!app/src',
    '!app/*.json'
  ], {
    base: 'app',
    dot: true
  })
  .pipe(debug({title: 'copying to dist:'}))
  .pipe(gulp.dest('dist'));
});

gulp.task('build', (cb) => {
  runSequence(
    'lint', 'scripts',
    ['manifest', 'extras'], cb);
});

gulp.task('clean', () => {
  return del(['dist', 'app/scripts']).then(paths =>
    paths.forEach(path => gutil.log('deleted:', gutil.colors.blue(path)))
  );
});

gulp.task('package', () => {
  let manifest = require('./dist/manifest.json');
  return gulp.src('dist/**')
  .pipe(zip('webdriver-extension-' + manifest.version + '.zip'))
  .pipe(gulp.dest('package'));
});

gulp.task('default', ['clean'], cb => {
  runSequence('build', cb);
});
