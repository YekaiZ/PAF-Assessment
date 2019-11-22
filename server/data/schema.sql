create table song_currently_listening (
        song_id varchar(128) not null,
        song_name varchar(128) not null,
        username varchar(128) not null,
        checkout_time timestamp not null,
        primary key(song_id, username)
    )