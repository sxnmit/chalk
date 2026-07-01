ALTER TABLE sessions
  ADD CONSTRAINT sessions_player_name_length CHECK (char_length(player_name) <= 30);
