const gulp = require('gulp');
const $ = require('gulp-load-plugins')();
const del = require('del');
const runSequence = require('run-sequence');
const webpack = require('webpack');

gulp.task('extras', () => {
  return gulp.src([
    'app/*.*',
    'app/_locales/**',
    'app/images/**',
    '!app/*.json'
  ], {
    base: 'app',
    dot: true
  }).pipe(gulp.dest('dist'));
});

function lint(files, options) {
  return () => {
    return gulp.src(files)
      .pipe($.eslint(options))
      .pipe($.eslint.format());
  };
}

gulp.task('lint', lint('app/scripts/**/*.js'));

gulp.task('webpack', (cb) => {
  webpack(require('./webpack.config.js'), function(err, stats) {
    if(err) {
      throw err;
    }
    $.util.log('[webpack]', stats.toString({
      colors: $.util.colors.supportsColor
    }));
    cb();
  });
});

gulp.task('chromeManifest', () => {
  return gulp.src('app/manifest.json')
    .pipe($.chromeManifest({
      buildnumber: true,
      background: {
        target: 'scripts/background.js',
        exclude: [
          'scripts/chromereload.js'
        ]
      }
    }))
  .pipe(gulp.dest('dist'));
});

gulp.task('clean', del.bind(null, ['.tmp', 'dist']));

gulp.task('watch', ['lint'], () => {
  $.livereload.listen();

  gulp.watch([
    'app/images/**/*',
    'app/_locales/**/*.json'
  ]).on('change', $.livereload.reload);

  gulp.watch('app/scripts/**/*.js', ['lint']);
});

gulp.task('size', () => {
  return gulp.src('dist/**/*').pipe($.size({title: 'build', gzip: true}));
});

gulp.task('package', function () {
  var manifest = require('./dist/manifest.json');
  return gulp.src('dist/**')
    .pipe($.zip('webdriver-extension-' + manifest.version + '.zip'))
    .pipe(gulp.dest('package'));
});

gulp.task('build', (cb) => {
  runSequence(
    'lint', 'chromeManifest',
    ['webpack', 'extras'],
    'size', cb);
});

gulp.task('default', ['clean'], cb => {
  runSequence('build', cb);
});
