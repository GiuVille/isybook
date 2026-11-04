-- Dark romance con una palette propria, un malva più scuro del romance (vedi src/lib/book-themes.ts).
alter table genres drop constraint if exists genres_theme_check;
alter table genres
  add constraint genres_theme_check check (theme in ('romance', 'dark-romance', 'giallo', 'horror', 'fantasy', 'ya', 'default'));

update genres set theme = 'dark-romance' where slug = 'dark-romance';
