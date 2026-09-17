> [!WARNING]
> **Beta verze.** Aplikace i tato dokumentace se stále vyvíjejí a jejich obsah bude průběžně
> upravován.

Tato část dokumentace popisuje zprovoznění UPolníčku na serveru s Dockerem: přípravu hostitele,
instalaci, ověření, že vyhodnocování skutečně funguje, dále aktualizace a zálohování. Je určena
správci serveru; vyučující ani studenti z ní nepotřebují nic.

## Předpoklady

| Požadavek                     | Důvod                                               |
| ----------------------------- | --------------------------------------------------- |
| Docker s Compose v2           | Veškeré služby včetně sestavení běží v kontejnerech |
| **cgroup v2 na hostiteli**    | Bez něj sandbox odmítne spustit vyhodnocování       |
| Přibližně 10 GB volného místa | Image, nástrojové řetězce workeru a nahrané soubory |
| DNS jméno nebo záznam v hosts | Systém se adresuje jménem, nikoli IP adresou        |

**Podporu cgroup v2 ověřte jako první**, neboť je to jediný z uvedených požadavků, který nelze
později vyřešit úpravou konfigurace. Odevzdaný kód běží uvnitř sandboxu `isolate` — téhož, jaký
používá IOI — a jeho verze 2.7 vyžaduje sjednocenou hierarchii cgroup:

```bash
mount | grep cgroup
```

Hostitel s cgroup v2 odpoví jediným připojením typu `cgroup2` na `/sys/fs/cgroup`. Jde o výchozí
stav současného Debianu, Ubuntu i RHEL a rovněž Docker Desktopu včetně systému macOS. Běží-li váš
stroj dosud na cgroup v1, README nasazení popisuje, jak místo toho použít starší verzi sandboxu.

## Instalace

Nejprve si stáhněte repozitář nasazení. Obsahuje soubor `docker-compose.yaml`, konfiguraci
jednotlivých služeb a skripty; samotný zdrojový kód systému v něm není.

```bash
git clone https://github.com/UPOL-KMI/upcode-deploy.git
cd upcode-deploy
```

Máte-li k organizaci přístup přes SSH klíč, funguje rovněž
`git clone git@github.com:UPOL-KMI/upcode-deploy.git`.

Poté stáhněte zdrojové kódy všech komponent. Skript `pull-repos.sh` naklonuje sedm repozitářů do
adresáře `repos/` a přepne každý z nich na revizi uvedenou v souboru `repos.lock` — tedy na tu, se
kterou bylo nasazení ověřeno, nikoli na aktuální vývojovou špičku. Vše se stahuje přes HTTPS,
takže server nepotřebuje žádný klíč ani přihlášení:

```bash
./pull-repos.sh
```

Nakonec si připravte konfiguraci:

```bash
cp .env.example .env
```

Následně upravte soubor `.env`. O tom, zda systém vůbec naběhne a zda bude bezpečný, rozhodují
především následující položky:

| Položka                                 | Obsah                                                                 |
| --------------------------------------- | --------------------------------------------------------------------- |
| `COMPOSE_PROJECT_NAME`                  | Jméno projektu, kterým se pojmenují svazky s daty. Viz poznámka níže  |
| `APP_DOMAIN`                            | Doménové jméno, na kterém systém poběží, bez protokolu a bez lomítka  |
| `MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD` | Nově zvolená hesla k databázi                                         |
| `JWT_SECRET`                            | Dlouhý náhodný řetězec. Jeho pozdější změna odhlásí všechny uživatele |
| `BROKER_AUTH_*`, `WORKER_FILES_AUTH_*`  | Sdílená tajemství mezi vnitřními službami                             |
| `RECODEX_INSTANCE_NAME`                 | Název instalace zobrazovaný v hlavičce a na úvodní stránce            |
| `LOCAL_REGISTRATION_ENABLED`            | Zda si uživatelé mohou zakládat účty sami. Ve výchozím stavu `false`  |
| `PROTOCOL`                              | `http`, nebo `https`, máte-li certifikát. Skládá se s `APP_DOMAIN`    |
| `SMTP_*`, `MAIL_FROM`                   | Odchozí pošta. Bez ní systém funguje, ale neodešle žádné oznámení     |

> [!IMPORTANT]
> **`COMPOSE_PROJECT_NAME` nastavte před prvním spuštěním.** Docker Compose jím pojmenovává svazky
> s daty a ve výchozím stavu jej odvozuje z názvu adresáře. Pokud adresář později přejmenujete,
> Compose přestane vidět původní svazky, založí prázdné a instalace naběhne, jako by byla nová.
> Data se neztratí, ale náprava znamená přenos mezi svazky. Zvolte jméno jednou a ponechte je.

Poté sestavte a spusťte systém:

```bash
docker compose build        # poprvé 5-10 minut: worker i sandbox se kompilují ze zdrojů
docker compose up -d
docker compose logs -f api  # první start pouští migrace, fixtury a import běhových prostředí
```

Než cokoli otevřete, vyčkejte, až se výpis služby `api` ustálí. První start provádí skutečnou práci:
zakládá databázové schéma, importuje balíčky běhových prostředí, bez nichž nelze vyhodnocovat,
a pojmenuje instanci podle `.env`.

U lokální instalace nejprve nasměrujte zvolené jméno na vlastní stroj:

```bash
echo "127.0.0.1  recodex.local" | sudo tee -a /etc/hosts
```

Poté otevřete `http://<APP_DOMAIN>/`.

## První účet

První start založí jediného správce s přihlašovacím jménem `admin@admin.com` a heslem `admin`.

> [!WARNING]
> **Přihlaste se a heslo změňte dříve, než bude stroj dostupný komukoli dalšímu.** Jde o veřejně
> známou dvojici uvedenou v této dokumentaci i v README nasazení a náleží jí plná oprávnění
> superadministrátora.

Vše ostatní se provádí přes rozhraní: založení skutečných účtů, přidělení role správce a následné
zablokování seedovaného účtu.

## Přehled služeb

| Služba       | Role                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------ |
| `proxy`      | Jediný port dostupný zvenčí. Směruje `/api/v1` a `/api/emails/` na API, zbytek na frontend |
| `web-next`   | Frontend, který uživatelé používají                                                        |
| `api`        | core-api: účty, skupiny, úlohy, zadání a oprávnění                                         |
| `api-worker` | Zpracovává úlohy API na pozadí, například rozesílání pošty                                 |
| `mysql`      | Databáze                                                                                   |
| `broker`     | Předává vyhodnocovací úlohy workerům                                                       |
| `worker`     | Spouští odevzdaný kód v sandboxu a vytváří verdikt                                         |
| `monitor`    | Streamuje průběh vyhodnocení do prohlížeče po dobu, kdy řešení běží                        |

### Co roste a co s tím

Přehled zabraného místa získáte příkazem `docker system df -v`. Roste trojí, každé jinak rychle
a s jiným řešením:

**Odevzdaná řešení (`api_storage`) rostou nejvíce a nikdy se nezmenšují.** Systém uchovává každý
odevzdaný soubor trvale. Jedno řešení bývá několik kilobajtů, takže kurz se dvěma sty studenty,
deseti zadáními a pěti pokusy na zadání zabere řádově stovky megabajtů za rok. **Nic zde nemažte
ručně** — databáze se na tyto soubory odkazuje a odstraněním souboru vznikne řešení, které nelze
stáhnout. Chcete-li uvolnit místo, smažte v rozhraní celá řešení nebo archivujte staré kurzy.

**Cache workeru (`worker_cache`) je adresovaná obsahem a starostí být nemusí.** Worker si do ní
ukládá soubory úloh (vstupy testů, očekávané výstupy, vlastní soudce), pojmenované otiskem svého
obsahu. Roste tedy s počtem různých souborů v katalogu úloh, nikoli s počtem odevzdání — na této
instalaci obsahuje 14 položek a 68 kB. Kdyby ji přesto bylo někdy třeba vyprázdnit, je to bezpečné:
worker si soubory stáhne znovu.

```bash
docker compose stop worker
docker run --rm -v <projekt>_worker_cache:/c alpine sh -c 'rm -rf /c/*'
docker compose start worker
```

**Logy nikdo nerotuje.** Svazek `api_log` bývá po několika měsících provozu největší položkou hned
po databázi. Omezte je nastavením ovladače logů v `docker-compose.yaml`, nebo je pravidelně mažte.

Úklidová služba (`cleaner`), kterou upstream pro cache workeru nabízí, součástí tohoto nasazení
není. Vzhledem k velikosti cache pro ni zatím není důvod.

## Jazyky, ve kterých mohou studenti odevzdávat

Image workeru instaluje `bash`, C a C++ (GCC), Python 3.13, .NET 8 SDK pro jazyk C# a JDK pro Javu;
API při prvním startu importuje odpovídající pipeliny. Každé prostředí vyžaduje **obojí**: nástroje
v image workeru a pipelinu v databázi, která popisuje, jak se řešení překládá, spouští a soudí.

Vedle nich je k dispozici prostředí **Data-Only** (`data-linux`), které žádný nástrojový řetězec
nepotřebuje. Přijímá libovolný soubor, nic nepřekládá ani nespouští a odevzdanému řešení přiděluje
nula bodů se stavem „Čeká na hodnocení"; body uděluje vyučující ručně. Slouží pro odevzdávání prací,
které nejsou programem.

Přidání dalšího jazyka znamená doinstalovat nástroje do `services/worker/Dockerfile`, doplnit jeho
název do `headers.env` v souboru `services/worker/config.yml.template`, přidat balíček do
`services/api/Dockerfile`, systém znovu sestavit a na již existující databázi balíček jednou ručně
naimportovat:

```bash
docker compose exec api php bin/console runtimes:import --yes /opt/recodex-runtimes/<balicek>.zip
```

Dvě připnuté verze jsou nosné a jsou zdokumentovány tam, kde jsou nastaveny: .NET je připnuto na
verzi 8, protože balíček pro jazyk C# odmítá přechod na verzi 9 i 10, a Python se kompiluje ze
zdrojů na verzi 3.13, protože debianí interpret verze 3.11 odmítá syntaxi, kterou studenti běžně
používají.

## Ověření, že vyhodnocování skutečně funguje

Instalace, která zobrazuje stránky, ještě není instalací, která vyhodnocuje. Zkouškou je odevzdat
řešení a přečíst si verdikt:

1. Přihlaste se jako správce.
2. Založte skupinu i úlohu, vložte do ní referenční řešení a zadejte ji.
3. Odevzdejte řešení vlastního zadání.
4. Sledujte průběh vyhodnocení a přečtěte si výsledek.

Zůstávají-li řešení ve frontě, worker se nespojil s brokerem. Vracejí-li se místo verdiktu jako
selhání, bývá příčinou sandbox:

```bash
docker compose logs worker | grep -E "cgroup v2 subtree|cgroup support"
```

## Aktualizace

```bash
./pull-repos.sh
docker compose build
docker compose up -d
```

API spouští databázové migrace při každém startu, takže změna schématu v nové verzi nevyžaduje
zvláštní krok.

## Zálohování

Zálohovat je třeba dva svazky, protože jen je nelze znovu vytvořit:

- `<projekt>_mysql_data` — databáze: účty, skupiny, zadání, body a verdikty.
- `<projekt>_api_storage` — nahrané soubory: přílohy úloh a každé odevzdané řešení.

Ostatní svazky (logy, cache workeru) se obnoví samy.

Nasazení obsahuje dva skripty, které obojí zálohují i obnovují ve správném pořadí:

```bash
./backup.sh -o /var/backups/upolnicek      # jeden adresář na běh, pojmenovaný časovým razítkem
./restore.sh /var/backups/upolnicek/upolnicek-2026-09-17_112616
```

Databáze se zálohuje výpisem, nikoli kopií svazku: kopie svazku běžící MariaDB zachytí rozepsané
stránky a výsledkem je archiv, který vypadá v pořádku až do dne, kdy z něj budete obnovovat. Skript
zálohuje nejprve soubory a teprve poté databázi — při opačném pořadí by záloha mohla obsahovat
záznam odkazující na soubor, který v ní není.

Pro pravidelné zálohování postačí záznam v cronu:

```bash
0 3 * * *  cd /var/www/upolnicek && ./backup.sh -o /var/backups/upolnicek >> /var/log/upolnicek-backup.log 2>&1
```

> [!WARNING]
> **Soubor `.env` součástí zálohy není**, protože obsahuje hesla k databázi a `JWT_SECRET`.
> Uchovejte jej odděleně, například ve správci hesel. Bez něj nelze zálohu obnovit na jiný stroj.
> Přepínačem `--with-env` jej lze do zálohy zahrnout, poté ovšem záloha obsahuje tajemství
> a náleží do odpovídajícím způsobem chráněného úložiště.

Obnovu si vyzkoušejte dříve, než ji budete potřebovat. Záloha, ze které nikdo nikdy neobnovoval, je
pouze soubor.

## Odchozí pošta

K provozu systému není pošta nezbytná, bez ní jsou však některé postupy nepohodlné: potvrzení
e-mailové adresy, obnova zapomenutého hesla, pozvánky do skupin i hromadné zprávy celé skupině
odesílají e-mail. Není-li nastavena skupina proměnných `SMTP_*`, tyto postupy proběhnou, ale zpráva
nikam nedorazí.

Vzhledem k tomu, že se účty zakládají pozvánkou, znamená nefunkční pošta rovněž to, že do systému
nelze přidat nového uživatele.
