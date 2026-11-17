-- Optional customer self-report; existing reviews retain unknown attendance.
ALTER TABLE temuevent.reviews ADD COLUMN reported_attendance BOOLEAN;
COMMENT ON COLUMN temuevent.reviews.reported_attendance IS 'Optional customer self-report, independent of organizer check-in and review eligibility.';
