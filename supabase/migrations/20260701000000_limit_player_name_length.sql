UPDATE sessions
SET player_name = left(player_name, 30)
WHERE char_length(player_name) > 30;

ALTER TABLE sessions
  ADD CONSTRAINT sessions_player_name_length CHECK (char_length(player_name) <= 30);
