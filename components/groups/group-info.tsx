import { getFormatter, getTranslations } from "next-intl/server";

import { getGroupAttributes, type GroupDetail } from "@/lib/api/group-detail";
import { formatPoints } from "@/lib/format/points";

import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { CreateGroup } from "@/components/groups/create-group";
import { SubgroupTree } from "@/components/groups/subgroup-tree";
import { Markdown } from "@/components/markdown/markdown";
import { Badge } from "@/components/status/badge";
import { Hint } from "@/components/status/hint";
import { splitGroupPoints } from "@/lib/status/group-points";
import { BonusPoints } from "@/components/format/bonus-points";

/**
 * The group's Info tab (S-005): what this group is, who runs it, what it contains, and -- for
 * someone who studies here -- where they stand in it.
 *
 * The description is authored markdown from the database and goes through D-010's renderer, the
 * same one exercise texts use, so a group description and an assignment text cannot render the
 * same source two different ways.
 *
 * The subgroup list is the visible half of S-010: ReCodEx groups genuinely nest, and both
 * directions are reachable from here -- ancestors through the breadcrumb the page builds, children
 * through this list. No tree widget: the hierarchy is shallow in practice and a breadcrumb plus a
 * child list is navigable with a keyboard and a screen reader, which a custom tree is not for free.
 */
function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border py-2 last:border-0 sm:flex-row sm:gap-4">
      <dt className="text-sm text-muted-foreground sm:w-56 sm:shrink-0">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export async function GroupInfo({
  group,
  staffView,
}: {
  group: GroupDetail;
  /** The reader administers, supervises or observes this group. */
  staffView: boolean;
}) {
  const myPoints = group.myStats ? splitGroupPoints(group.myStats) : null;
  const [t, format, attributes] = await Promise.all([
    getTranslations("Group.info"),
    getFormatter(),
    getGroupAttributes(group.id),
  ]);

  const roleOrder: GroupDetail["members"][number]["role"][] = ["admin", "supervisor", "observer"];
  const membersByRole = roleOrder
    .map((role) => ({ role, people: group.members.filter((member) => member.role === role) }))
    .filter((entry) => entry.people.length > 0);

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="group-description">
        <h2 id="group-description" className="mb-3 text-base font-semibold tracking-tight">
          {t("description")}
        </h2>
        {group.description ? (
          <Markdown source={group.description} />
        ) : (
          <p className="text-sm text-muted-foreground">{t("noDescription")}</p>
        )}
      </section>

      {group.myStats && myPoints && (
        <section aria-labelledby="group-my-standing">
          <h2 id="group-my-standing" className="mb-3 text-base font-semibold tracking-tight">
            {t("myStanding")}
          </h2>
          {/* **A flex row, and the badge centred rather than aligned.** These four things are three
              different type sizes on one line; as inline flow the pill's `align-middle` resolved
              against the 2xl parent and sat below everything else. The words share a baseline with
              the number, and the pill -- which has no baseline worth sharing -- centres on it. */}
          <p className="flex flex-wrap items-baseline gap-x-2 text-2xl font-semibold tabular-nums">
            <span>
              {/* core-api folds the bonus into this total; `splitGroupPoints` takes it back apart,
                  so this tile says what every other screen says. */}
              {formatPoints(myPoints.gained, myPoints.total)}
              <BonusPoints bonus={myPoints.bonus} />
            </span>
            <span className="text-sm font-normal text-muted-foreground">{t("points")}</span>
            {group.myStats.hasLimit && (
              <span className="ml-1 self-center">
                <Hint text={t("thresholdExplain")}>
                  <Badge tone={group.myStats.passesLimit ? "success" : "warning"}>
                    {group.myStats.passesLimit ? t("limitMet") : t("limitNotMet")}
                  </Badge>
                </Hint>
              </span>
            )}
          </p>
        </section>
      )}

      <section aria-labelledby="group-metadata">
        <h2 id="group-metadata" className="mb-3 text-base font-semibold tracking-tight">
          {t("metadata")}
        </h2>
        <dl>
          {group.path.length > 0 && (
            <InfoRow label={t("parent")}>
              <Link
                href={`/groups/${group.path[group.path.length - 1]!.id}`}
                className="hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {group.path[group.path.length - 1]!.name}
              </Link>
            </InfoRow>
          )}
          <InfoRow label={t("assignments")}>
            {group.organizational ? (
              t("organizationalNote")
            ) : (
              <>
                {group.assignmentCount}
                {group.shadowAssignmentCount > 0 && (
                  <span className="text-muted-foreground">
                    {" "}
                    ({t("shadowCount", { count: group.shadowAssignmentCount })})
                  </span>
                )}
              </>
            )}
          </InfoRow>
          {group.studentCount !== null && (
            <InfoRow label={t("students")}>{group.studentCount}</InfoRow>
          )}
          {group.pointsLimit !== null && group.pointsLimit > 0 && (
            <InfoRow label={t("pointsLimit")}>{group.pointsLimit}</InfoRow>
          )}
          {group.threshold !== null && group.threshold > 0 && (
            <InfoRow label={t("threshold")}>
              {format.number(group.threshold, { style: "percent", maximumFractionDigits: 1 })}
              {/* A percentage of what, in the reader's own numbers. Only where the reader has a
                  total of their own -- a teacher has none, and inventing one would be a guess. */}
              {group.myStats !== null && group.myStats.points.total > 0 && (
                <span className="text-muted-foreground">
                  {" "}
                  ({Math.ceil(group.threshold * group.myStats.points.total)}/
                  {group.myStats.points.total})
                </span>
              )}
            </InfoRow>
          )}
          {/* A group setting, and the group's staff are who it is about: a student reading "no"
              learns only that they cannot see something they were not looking for. */}
          {staffView && (
            <InfoRow label={t("publicStats")}>{group.publicStats ? t("yes") : t("no")}</InfoRow>
          )}
          {group.detaining && <InfoRow label={t("detaining")}>{t("detainingNote")}</InfoRow>}
        </dl>
      </section>

      {membersByRole.length > 0 && (
        <section aria-labelledby="group-people">
          <h2 id="group-people" className="mb-3 text-base font-semibold tracking-tight">
            {t("people")}
          </h2>
          <dl>
            {membersByRole.map(({ role, people }) => (
              <InfoRow key={role} label={t(`roles.${role}`)}>
                <ul className="flex flex-wrap gap-x-3 gap-y-1">
                  {people.map((person) => (
                    <li key={person.id}>
                      <Link
                        href={`/users/${person.id}`}
                        className="hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        {person.fullName || person.id}
                      </Link>
                    </li>
                  ))}
                </ul>
              </InfoRow>
            ))}
          </dl>
        </section>
      )}

      {(group.subgroups.length > 0 || group.can.addSubgroup === true) && (
        <section aria-labelledby="group-subgroups" className="flex flex-col gap-3">
          <h2 id="group-subgroups" className="text-base font-semibold tracking-tight">
            {t("subgroups")}
          </h2>
          {group.subgroups.length > 0 ? (
            /* core-api returns the whole subtree here, not the children -- see `SubgroupTree`. */
            <SubgroupTree rootId={group.id} subgroups={group.subgroups} />
          ) : (
            <p className="text-sm text-muted-foreground">{t("noSubgroups")}</p>
          )}
          {group.can.addSubgroup === true ? (
            <CreateGroup
              parentGroupId={group.id}
              locales={routing.locales}
              label={t("addSubgroup")}
            />
          ) : (
            /* Said where the button would have been. The operator gave a colleague the *group*
               role Cvičící and expected subgroups to follow -- reasonably, since the instance role
               that actually decides it carries the same word. An absent button explained nothing. */
            <p className="text-xs text-muted-foreground">{t("whoMayAddSubgroup")}</p>
          )}
        </section>
      )}

      {attributes.length > 0 && (
        <section aria-labelledby="group-ext-attrs">
          <h2 id="group-ext-attrs" className="mb-3 text-base font-semibold tracking-tight">
            {t("externalAttributes.title")}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">{t("externalAttributes.service")}</th>
                  <th className="pb-2 pr-4 font-medium">{t("externalAttributes.key")}</th>
                  <th className="pb-2 font-medium">{t("externalAttributes.value")}</th>
                </tr>
              </thead>
              <tbody>
                {attributes.map((attr) => (
                  <tr key={attr.id} className="border-b border-border last:border-0">
                    <td className="py-2 pr-4">
                      <code className="rounded bg-muted px-1 py-0.5 text-xs">{attr.service}</code>
                    </td>
                    <td className="py-2 pr-4">
                      <code className="rounded bg-muted px-1 py-0.5 text-xs">{attr.key}</code>
                    </td>
                    <td className="py-2">
                      <code className="rounded bg-muted px-1 py-0.5 text-xs">{attr.value}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
