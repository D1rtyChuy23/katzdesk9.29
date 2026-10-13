-- The Library: a parts file keeps the name it was dropped with. Parts files that were given a generated
-- "<Model> - Parts Book" (or "- Parts Diagram") title get their original name back. A name someone typed is left alone.
update library_files
   set name = original_name
 where section = 'parts'
   and original_name is not null
   and original_name <> ''
   and name ~ ' - Parts (Book|Diagram)( [0-9]+)?\.[A-Za-z0-9]+$';
