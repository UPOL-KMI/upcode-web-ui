> [!WARNING]
> **Beta release.** Both the application and this documentation are still under development and
> their content will be revised as the work continues.

This part of the documentation describes how to bring UPolníček up on a server running Docker:
preparing the host, installing, establishing that evaluation actually works, and then updating and
backing up. It is written for whoever administers the server; teachers and students need nothing
from it.

## Prerequisites

| Requirement                      | Reason                                                 |
| -------------------------------- | ------------------------------------------------------ |
| Docker with Compose v2           | Every service, the build included, runs in containers  |
| **cgroup v2 on the host**        | Without it the sandbox refuses to run evaluations      |
| Roughly 10 GB of free space      | Images, the worker's toolchains and uploaded files     |
| A DNS name, or an entry in hosts | The system addresses itself by name, not by IP address |

**Check for cgroup v2 support first**, as it is the only one of these requirements that cannot be
resolved later by changing configuration. Submitted code runs inside the `isolate` sandbox — the
same one used at the IOI — and its version 2.7 requires a unified cgroup hierarchy:

```bash
mount | grep cgroup
```

A host with cgroup v2 answers with a single `cgroup2` mount on `/sys/fs/cgroup`. That is the default
on current Debian, Ubuntu and RHEL, and on Docker Desktop including macOS. If your machine still
runs cgroup v1, the deployment README describes how to use the older sandbox instead.

## Installation

First clone the deployment repository. It holds `docker-compose.yaml`, the configuration of each
service and the scripts; the system's own source code is not in it.

```bash
git clone https://github.com/UPOL-KMI/upcode-deploy.git
cd upcode-deploy
```

If you have SSH access to the organisation,
`git clone git@github.com:UPOL-KMI/upcode-deploy.git` works as well.

Then fetch the source of every component. `pull-repos.sh` clones eight repositories into `repos/`
and checks each one out at the revision named in `repos.lock` — that is, the revision the deployment
was verified against, rather than the current development tip:

```bash
./pull-repos.sh
```

Finally prepare the configuration:

```bash
cp .env.example .env
```

Then edit `.env`. The following entries determine whether the system comes up at all, and whether it
is safe once it does:

| Entry                                   | Contents                                                                   |
| --------------------------------------- | -------------------------------------------------------------------------- |
| `COMPOSE_PROJECT_NAME`                  | The project name the data volumes are named after. See the note below      |
| `APP_DOMAIN`                            | The domain name the system will run on, without protocol or trailing slash |
| `MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD` | Newly chosen database passwords                                            |
| `JWT_SECRET`                            | A long random string. Changing it later signs everybody out                |
| `BROKER_AUTH_*`, `WORKER_FILES_AUTH_*`  | Secrets shared between the internal services                               |
| `RECODEX_INSTANCE_NAME`                 | The name of the installation, shown in the header and on the landing page  |
| `LOCAL_REGISTRATION_ENABLED`            | Whether people may create accounts themselves. `false` by default          |
| `PROTOCOL`                              | `http`, or `https` if you have a certificate. Combined with `APP_DOMAIN`   |
| `SMTP_*`, `MAIL_FROM`                   | Outgoing mail. Without it the system works but sends no notification       |

> [!IMPORTANT]
> **Set `COMPOSE_PROJECT_NAME` before the first start.** Docker Compose names the data volumes after
> it and derives it from the directory name by default. Rename the directory later and Compose stops
> seeing the original volumes, creates empty ones, and the installation comes up as though it were
> new. Nothing is lost, but putting it right means moving data between volumes. Choose the name once
> and leave it alone.

Then build and start the system:

```bash
docker compose build        # 5-10 minutes the first time: the worker and the sandbox are compiled
docker compose up -d
docker compose logs -f api  # the first start runs migrations, fixtures and the runtime import
```

Before opening anything, wait for the `api` log to settle. The first start does real work: it
creates the database schema, imports the runtime environment packages without which nothing can be
evaluated, and names the instance according to `.env`.

For a local installation, first point the chosen name at your own machine:

```bash
echo "127.0.0.1  recodex.local" | sudo tee -a /etc/hosts
```

Then open `http://<APP_DOMAIN>/`.

## The first account

The first start creates a single administrator, with the sign-in name `admin@admin.com` and the
password `admin`.

> [!WARNING]
> **Sign in and change that password before the machine is reachable by anyone else.** It is a
> publicly known pair, stated both in this documentation and in the deployment README, and it holds
> full superadministrator rights.

Everything else is done through the interface: creating real accounts, granting somebody the
administrator role, and then disabling the seeded account.

## The services

| Service      | Role                                                                                                           |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| `proxy`      | The only port reachable from outside. Routes `/api/v1` and `/api/emails/` to the API, the rest to the frontend |
| `web-next`   | The frontend people use                                                                                        |
| `api`        | core-api: accounts, groups, exercises, assignments and permissions                                             |
| `api-worker` | Runs the API's background work, such as sending mail                                                           |
| `mysql`      | The database                                                                                                   |
| `broker`     | Hands evaluation jobs to the workers                                                                           |
| `worker`     | Runs submitted code in the sandbox and produces the verdict                                                    |
| `monitor`    | Streams the progress of an evaluation to the browser while the solution runs                                   |

### What grows, and what to do about it

`docker system df -v` reports the space in use. Three things grow, each at its own rate and each
with its own remedy:

**Submitted solutions (`api_storage`) grow the most and never shrink.** Every submitted file is kept
indefinitely. One solution is usually a few kilobytes, so a course of two hundred students with ten
assignments and five attempts each accounts for a few hundred megabytes a year. **Never delete
anything here by hand** — the database refers to these files, and removing one leaves a solution
that cannot be downloaded. To free space, delete whole solutions through the interface or archive
old courses.

**The worker's cache (`worker_cache`) is content-addressed and is not a concern.** The worker stores
exercise files in it — test inputs, expected outputs, custom judges — named by the digest of their
contents. It therefore grows with the number of distinct files in the exercise catalogue, not with
the number of submissions: on this installation it holds 14 entries and 68 kB. Should it ever need
emptying, doing so is safe; the worker fetches the files again.

```bash
docker compose stop worker
docker run --rm -v <project>_worker_cache:/c alpine sh -c 'rm -rf /c/*'
docker compose start worker
```

**Nothing rotates the logs.** After a few months of use the `api_log` volume tends to be the largest
item after the database. Cap it through the logging driver in `docker-compose.yaml`, or clear it
periodically.

The cleanup service (`cleaner`) that upstream offers for the worker's cache is not part of this
deployment. Given the size of that cache there is as yet no reason for it.

## The languages students may submit in

The worker image installs `bash`, C and C++ (GCC), Python 3.13, the .NET 8 SDK for C# and a JDK for
Java; the API imports the corresponding pipelines on its first start. Every environment needs
**both**: the tools in the worker image and a pipeline in the database describing how a solution is
compiled, run and judged.

Alongside them there is the **Data-Only** environment (`data-linux`), which needs no toolchain at
all. It accepts any file, compiles and runs nothing, and gives the submitted solution zero points
with the state "Awaiting grading"; the teacher awards the points by hand. It exists for submissions
that are not a program.

Adding a further language means installing the tools in `services/worker/Dockerfile`, adding its
name to `headers.env` in `services/worker/config.yml.template`, adding the package to
`services/api/Dockerfile`, rebuilding, and then — on an existing database — importing the package
once by hand:

```bash
docker compose exec api php bin/console runtimes:import --yes /opt/recodex-runtimes/<package>.zip
```

Two pinned versions are load-bearing and are documented where they are set: .NET is pinned to
version 8 because the C# package refuses to move to 9 or 10, and Python is compiled from source at
version 3.13 because Debian's own 3.11 interpreter rejects syntax students routinely write.

## Establishing that evaluation actually works

An installation that serves pages is not yet an installation that grades. The test is to submit a
solution and read its verdict:

1. Sign in as the administrator.
2. Create a group and an exercise, give the exercise a reference solution, and assign it.
3. Submit a solution to your own assignment.
4. Watch the evaluation and read the result.

If solutions stay in the queue, the worker has not reached the broker. If they come back as failures
rather than verdicts, the sandbox is the usual cause:

```bash
docker compose logs worker | grep -E "cgroup v2 subtree|cgroup support"
```

## Updating

```bash
./pull-repos.sh
docker compose build
docker compose up -d
```

The API runs database migrations on every start, so a schema change in a new version needs no
separate step.

## Backups

Two volumes have to be backed up, because they are the only ones that cannot be recreated:

- `<project>_mysql_data` — the database: accounts, groups, assignments, points and verdicts.
- `<project>_api_storage` — uploaded files: exercise attachments and every submitted solution.

The remaining volumes (logs, the worker's cache) rebuild themselves.

The deployment ships two scripts that back both up, and restore them, in the right order:

```bash
./backup.sh -o /var/backups/upolnicek      # one directory per run, named by the timestamp
./restore.sh /var/backups/upolnicek/upolnicek-2026-09-17_112616
```

The database is backed up by dumping it rather than by copying its volume: copying the volume of a
running MariaDB captures half-written pages, and the result is an archive that looks fine until the
day you restore from it. The script takes the files first and the database second — the other way
round, a backup could hold a record pointing at a file it does not contain.

A cron entry is enough for regular backups:

```bash
0 3 * * *  cd /var/www/upolnicek && ./backup.sh -o /var/backups/upolnicek >> /var/log/upolnicek-backup.log 2>&1
```

> [!WARNING]
> **`.env` is not part of the backup**, because it holds the database passwords and `JWT_SECRET`.
> Keep it separately, in a password manager for instance. Without it a backup cannot be restored
> onto another machine. The `--with-env` switch includes it, but the backup then carries secrets and
> belongs in storage protected accordingly.

Try a restore before you need one. A backup nobody has ever restored from is only a file.

## Outgoing mail

The system does not need mail in order to run, but several procedures are awkward without it:
confirming an e-mail address, resetting a forgotten password, group invitations and messages sent to
a whole group all send an e-mail. Where the `SMTP_*` group of variables is not configured, those
procedures complete but the message arrives nowhere.

Since accounts are created by invitation, mail that does not work also means that no new user can be
added to the system.
