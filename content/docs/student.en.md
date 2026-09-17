> [!WARNING]
> **Beta release.** Both the application and this documentation are still under development and
> their content will be revised as the work continues.

This part of the documentation describes how a student signs in to the system, enrols in courses,
submits solutions and reads the results of their evaluation.

## Signing in and the user account

Sign in using your university account if the option is available on the sign-in page (planned for
Q1/2027). Otherwise you have to ask one of your teachers to send you an invitation to the system.
**Self-service registration is not currently permitted.**

The invitation arrives by e-mail and has a limited validity; the date is stated both in the message
and on the page the link opens. Once it has expired, ask for a new one — the original cannot be
extended. After opening the link, choose a password for the account; submitting the form creates
the account.

A forgotten password is reset through the **I cannot remember my password** link on the sign-in
page. This applies only to accounts with a password of their own; for a university account the
password is managed by the university.

Confirm your e-mail address using the link delivered to your mailbox once the account is created.
The system sends notifications of approaching deadlines, evaluation results and completed reviews to
that address. Until the address is confirmed, no e-mail is sent.

## Enrolling in a course

Enrolment takes place after signing in, in one of two ways depending on how the course's visibility
is set:

1. Open **My groups → All groups** in the menu and search for the course. If you find it, open its
   detail and use the **Join the group** button.
2. Otherwise you have to ask the teacher either to add you to the course directly, or to send you a
   link that opens enrolment.

Whether you can leave a course yourself depends on that course's own settings: either its detail
offers a **Leave the group** button, or the course information states that students cannot leave on
their own. In the second case you have to ask the teacher to remove you. Submitted solutions are
preserved even after leaving the group.

## Courses and deadlines

After signing in, a student is presented with the **Dashboard**, which contains:

- **Coming up** — assignments open for submission, ordered by the nearest deadline. Each row states
  the course, the deadline, the maximum number of points and the current state of your submissions.
- **Calendar** — a monthly view of the same deadlines, which can be paged month by month.
- **Graded without submission** — work the system does not evaluate (an oral examination, a
  presentation, attendance). Points are awarded manually by the teacher and the stated deadline is
  informative only.
- **My progress** — your points so far in each course, including the threshold required to pass
  where one is set.

The **My groups** menu section lists the running courses you are enrolled in. The **All groups** tab
may additionally show public groups that you are free to join.

## Submitting a solution

Before submitting, read the assignment and its terms carefully — in particular the deadline, the
number of points, the maximum number of attempts and the programming languages accepted for the
submission.

Having chosen **Submit a solution**, proceed as follows:

1. Upload the files containing your solution. The maximum number of files and their permitted size
   are stated above the form.
2. If the assignment accepts more than one programming language, select the one you used. The choice
   is derived from the names of the uploaded files; where an assignment has a single language, the
   field is not shown.
3. If your solution consists of several files, name the program's entry point in the **File to
   start** field. Without this the solution cannot be submitted, and deliberately so: a default
   taken in alphabetical order would often start the wrong file, and the result would be zero points
   that look like a fault in the solution.
4. Optionally add a **Note**. It is visible only to you and to the teachers of the course.
5. Confirm with the **Submit** button.

**Whether an archive may be submitted depends on the particular assignment.** The system matches the
uploaded files by name against the pattern given in the exercise configuration — where an exercise
expects `*.py`, an archive does not match that pattern and the submission is refused. If in doubt,
submit the individual source files.

Once submitted, the system processes the solution and begins evaluating it automatically. For
ordinary programming assignments the evaluation takes a few seconds. There is no need to refresh the
page; the result appears by itself as soon as the evaluation finishes.

## Assignments without automatic evaluation

An assignment need not contain a program intended for automatic evaluation. A teacher may ask for a
text document, measured data, a presentation or a PDF document.

The submission procedure is the same in such a case. The file is not processed automatically,
though: the solution is given the state **Awaiting grading** and no points. Having received the
solution, the teacher reviews it and awards the points manually.

The deadline, the maximum number of attempts and any feedback work exactly as they do for
automatically evaluated assignments.

## The result of the evaluation

Once the evaluation finishes, the system shows the score achieved and the results of the individual
tests.

Each test states its result, the score achieved, the time and memory consumed, how close those came
to the limits, and the program's exit code.

| Result                    | Meaning                                                            |
| ------------------------- | ------------------------------------------------------------------ |
| **Passed**                | The solution passed the test.                                      |
| **Failed**                | The program ran, but its output did not match the expected result. |
| **Skipped**               | The test was not run because an earlier step had failed.           |
| **Time limit exceeded**   | The program exceeded the time limit set for it.                    |
| **CPU limit exceeded**    | The program exceeded the limit on processor time.                  |
| **Memory limit exceeded** | The program exceeded the limit on memory use.                      |

The attempt as a whole may additionally end in one of these states:

| State                                                  | Meaning                                                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| **Correct / Partially correct / Incorrect** (auto)     | The grade was computed from the tests. The teacher may change it afterwards.                |
| **Compilation failed**                                 | The solution could not be compiled and no test was run. The compiler's output is available. |
| **Evaluation failed**                                  | The evaluation system failed, not your solution. It does not consume an attempt.            |
| **Awaiting grading**                                   | This assignment is not evaluated automatically; the teacher awards the points.              |
| **Graded by the teacher**, **Points from the teacher** | The grade was set by the teacher rather than computed automatically.                        |
| **Not scored**                                         | No points are awarded for this assignment.                                                  |

The overall score is computed from which tests passed and from their weights; a teacher may use a
formula of their own instead of weighting. A partially correct solution can therefore earn a
proportional part of the points.

For tests that did not pass, the expected and actual output can be compared — the **Judge output**
sets out the differences line by line and includes a legend for the notation it uses. How much of
the actual output a student is shown is determined by the teacher in the exercise settings.

Where the automatic grade is unsatisfactory, first re-read the assignment carefully and check that
your solution addresses it completely. If you are not sure where the fault lies, request a review of
the solution, or raise the matter with the teacher at the time set aside for it — during a seminar
or in consultation hours. If, on the other hand, you are aware of the fault and have corrected it,
you may upload a new solution (up to the configured limit), which will be evaluated again.

**As a rule the solution with the highest score is the one that counts, unless the teacher decides
otherwise.** The exact order of the rules is this: if the teacher has marked a solution as
**Accepted**, that one counts; otherwise the solution with the most points; and where two are equal
on points, the more recent one. Submitting a further attempt therefore cannot worsen your grade,
though it does consume one attempt.

## Deadlines and the number of attempts

An assignment may have a second, late deadline carrying a reduced number of points.

Where the number of submission attempts is limited, the assignment screen states how many you have
left. Before submitting, check your solution against the example given in the assignment. **How
strictly the output is compared is determined by the judge chosen for that particular exercise**:
some compare the output character by character including whitespace, others disregard the order of
words on a line or the order of whole lines.

## Requesting a review

The solution screen allows you to ask the teacher for a review. The solution thereby enters their
queue and the teacher is notified; the request can be withdrawn at any time.

A review is a set of comments — either on particular lines of the submitted solution, or on the
solution as a whole. A comment marked as an **issue to fix** is a defect whose correction the
teacher expects. The comments become visible only once the teacher closes the review.

## Examination mode

For the duration of an examination a teacher may lock you into a single course. While the lock is in
force the other courses are inaccessible and an invitation link to another group is refused; the
lock is released by itself once the examination ends.

## Troubleshooting

- **The evaluation ended with an infrastructure error.** This is not a fault in your solution and it
  does not consume an attempt. Report it to your teacher; resubmitting is pointless until the cause
  has been removed.
- **You believe the solution is correct, but a test did not pass.** Read the Judge output and verify
  the exact wording of the output, then request a review and state where you believe the test is at
  fault.
- **The solution cannot be submitted.** The deadline has passed, you have used up your attempts, the
  course no longer accepts solutions, or submission is temporarily disabled across the whole
  instance. The assignment screen states the particular reason.
- **No e-mail notifications arrive.** Check that your address is confirmed; nothing is sent to an
  unconfirmed address.
- **If you have questions**, you may post to the discussion attached to each assignment. For a
  question about the evaluation of one particular solution of yours, start the discussion in the
  detail of that submitted attempt.
