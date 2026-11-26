-- The delivery note PDF now prints its own "Remarks" lines after the items
-- table. Remove the old trailing remarks block from saved templates (only when
-- the template still ends with exactly that block).
UPDATE "DocumentTemplate"
SET "body" = regexp_replace("body", E'\\n\\s*\\n(Remarks|ملاحظات):\\s*\\n…+\\s*$', '')
WHERE "kind" = 'DELIVERY_NOTE';
