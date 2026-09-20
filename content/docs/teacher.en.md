> [!WARNING]
> **Beta release.** Both the application and this documentation are still under development and
> their content will be revised as the work continues.

This part of the documentation describes how a teacher creates a course, prepares exercises, assigns
them to students, grades the solutions that come in and runs an examination.

## The basic concepts

The system works with four concepts, and every other setting is a detail of one of them.

- A **group** is a course, or a seminar group within a course. It holds students and assignments and
  may contain subgroups.
- An **exercise** is defined by its text, optionally by its tests, by a model solution and by the
  resource limits set for it. Exercises live in a catalogue independently of any course and, subject
  to permissions, can be assigned to any group.
- An **assignment** is one particular exercise given to one particular group, with deadlines and
  points of its own. The same exercise can be assigned in any number of courses, each with different
  deadlines.
- A **solution** is one attempt by one student against one assignment. The system may evaluate and
  score it automatically, and the teacher may change the resulting grade.

The distinction between an exercise and an assignment is the one that matters: **an exercise is
written once and assigned many times.** Editing it later does not affect the courses it is already
assigned in until you trigger the synchronisation yourself.

## Creating a course, and archiving it later

A course is created in the **Groups** section. A name in at least one interface language (Czech or
English) is required; the other can be added later.

Three kinds of group govern how a course behaves:

- **Organizational** — may contain further groups, but holds no students and no assignments.
- **Ordinary** — as organizational, except that assignments can be given in it and students added
  to it.
- **Exam** — a flag on an ordinary group, for a group in which an examination is held. It has three
  consequences: assignments created in such a group are automatically marked as exam assignments and
  are shown to a student during the examination only if that student is locked into the group;
  students cannot leave the group on their own; and the group cannot contain subgroups. An exam
  group cannot also be marked organizational.

Independently of its kind, a group can be marked **public**, which means students may enrol
themselves without the teacher's involvement.

Once a term or an academic year ends, inactive groups can be archived. An archived group can still
be returned to, but it disappears from the list of active courses for students and teachers alike.

Students can be brought into a course in three ways: they enrol themselves where the course is
public; you add them by hand from the list of users; or you send them an **invitation link** with a
limited validity. The links are managed in the course detail, and each shows who issued it and how
long it remains valid.

The course settings further determine whether students may leave the group on their own, and whether
they see the group's aggregate statistics.

### Who may open a subgroup

A subgroup is opened by a group's **administrator**, and by a **supervisor holding the instance role
_Empowered supervisor_**. That role is set by a system administrator on the person (People → Users →
_Role_), not among the group's members — it is a different axis from
administrator/supervisor/observer inside a course.

**Whoever opens a group administers it.** The creator is listed as an administrator of the new group
with every right that carries: renaming it, archiving it, adding staff, opening further subgroups.
It does not reach upward — no rights over the parent course come with it.

That is the whole point of the arrangement. Administrator membership **inherits downward**: whoever
administers `Teaching` administers every course beneath it. If each teacher is to run their own
course and see nothing of anyone else's, do not make them administrators of the shared parent --
give them **supervisor** membership there and the instance role _Empowered supervisor_. Supervisor
membership does not inherit, so each of them sees only their own.

## Preparing an exercise

A new exercise is created in the **Exercises** section. Before it can be assigned its configuration
has to be complete; until it is, the system marks it as incomplete and states the particular reason
— a missing text, no tests, no method of computing the score, no programming language selected, an
incomplete test configuration or invalid limits.

1. **The text of the task.** Written in Markdown, separately for each language you wish to offer
   the assignment in — Czech, English or both. Code blocks and mathematics written as `$...$` and
   `$$...$$` are rendered.
2. **Tests.** Each test states what goes into the program and what output is expected. The
   comparison is performed by a built-in judge; depending on which judge is chosen, the output is
   compared character by character, or without regard to the order of words on a line or the order
   of whole lines.
3. **Limits.** A time and memory limit has to be set for each test and each programming language.
   Start from the values measured for the reference solution and leave a real margin — the machine
   that grades does not have the performance of a student's laptop.
4. **A reference solution.** A correct solution that you submit yourself. It is not technically
   required in order to assign the exercise, but **it is the only way to establish that the tests,
   the limits and the configuration actually work together**, and most configuration faults show up
   on it.

Submit the reference solution and read its result before giving the exercise to students. If it does
not earn full marks, the exercise is not ready — every student would meet the same obstacle.

### Exercises without automatic evaluation

Not every piece of work can be run and tested. For essays, measured data, presentations or scanned
documents there is the **Data-Only** environment, chosen among the exercise's programming
languages in the **Languages** section. It accepts any file regardless of its extension, compiles
and runs nothing, and has neither tests nor limits — the exercise configuration is therefore reduced to the text of the task
itself.

The submitted solution is given the state **Awaiting grading** and no points. You award the points
by hand on the solution screen; only then is the solution considered graded. Until you do, the
system asserts no verdict to the student.

Data-Only cannot be combined with any programming language in the same exercise; the interface says
so.

### Importing from GitHub Classroom (beta)

An assignment containing an `autograding.json` file can be imported instead of being retyped. Tests
of type `input` and `output` are converted into tests in the system, the template's `README.md`
becomes the text of the exercise and the remaining files become attachments.

What cannot be converted, the import states explicitly: neither a test that runs an arbitrary shell
command nor an entire testing framework inside the repository can be reduced to input/output pairs.
A Classroom template also practically never contains a reference solution, so one has to be added.

## Assigning an exercise to students

In the course detail, choose to assign an exercise. The selection begins with your course's own
exercises and can be widened to the whole catalogue.

You then set the terms:

- **The first deadline** and the number of points valid until it passes.
- **A second deadline**, optionally, carrying fewer points. The points may drop abruptly after the
  first deadline, or decrease gradually between the two.
- **The point threshold** — what share of the points a solution has to earn before it counts for the
  student at all.
- **The attempt limit** — how many times a student may submit. Unless this is an examination, we
  recommend setting it generously.
- **Visible from** — the assignment exists but is not shown to students until the stated moment.
- **The permitted programming languages** a student may submit in.

Deadlines are entered in your own time zone and displayed to every user in theirs.

If you edit an exercise after it has been assigned, the change does not reach the existing
assignments by itself. An assignment holds its own copy of the configuration, and its
synchronisation with the exercise has to be triggered.

## Grading the solutions that come in

The **Solutions** tab of an assignment lists the individual attempts, one row per submission.
Opening a particular solution shows the submitted files, the result of every test and how the
solution's score in points was arrived at. Of one student's submitted solutions exactly one is
chosen, and its points are the ones that count towards the overall grade.

From the solution screen you can do the following:

- **Change the number of points.** The automatic grade is overridden by your own, with a note giving
  the reason. Use it for a solution that is correct in a way the tests do not capture, or wrong in a
  way that escaped them.
- **Accept an attempt.** An accepted solution counts towards the grade in preference to all others,
  even if another attempt earned more points.
- **Write a review.** Comments on particular lines of the code, or on the solution as a whole. A
  comment can be marked as an issue to fix. **A review stays hidden from the student until you close
  it.**
- **Re-evaluate a solution.** Runs the tests again, for instance after a misconfigured exercise has
  been repaired.
- **Compare two attempts** line by line and see what changed between them.

Without any intervention from the teacher, the solution counted towards the grade is the one with
the most points, not the most recent. Where two are equal on points, the newer attempt wins. If you
accept a solution, it takes precedence over both rules.

Students may request a review themselves. The requests collect on your dashboard, so the queue of
open reviews is a place you look at rather than something you have to remember.

## An overview of the whole course

The **Students** tab presents a matrix of points: every student against every assignment, with
totals. The matrix can be exported, and every cell links to that student's attempts.

Each student additionally has a screen of their own within the course, with everything they have
submitted in one place. It is usually the quickest answer to the question of how a particular person
is getting on.

## Points awarded without a submission

A **shadow assignment** records points for work students do not submit to the system — a
presentation, an oral examination or participation in a seminar. It appears in the course's scoring
beside ordinary assignments, and you enter the points yourself, student by student, together with
the date on which they were earned.

The deadline of a shadow assignment is informative only: the system enforces nothing by it, and
whether it was met is for you to decide.

## Examinations

A course can be switched into examination mode for a chosen period. The examination begins
immediately or at a time you set, lasts for a given duration or until a given end, and may lock
students into the course for that time. A locked student sees only that course for the duration, and
invitation links to other groups are refused meanwhile.

Set the examination mode up before the room fills. The **Exams** tab shows the progress, the list of
locked students and the records of examinations held earlier; individual students can be released
where necessary.
