#!/usr/bin/env python3
"""Smoke test da API real, usando somente a biblioteca padrão do Python.

Uso: python3 scripts/smoke-api.py --base-url http://127.0.0.1:18080

Execute apenas contra um banco descartável. Cada execução cadastra duas contas
sintéticas com identificadores únicos. As contas permanecem no banco porque não
há endpoint de exclusão de usuário. Tarefas, metas e lembretes criados pelo teste
são removidos em finally, inclusive quando uma verificação falha. Recursos
preexistentes nunca são alterados. Senhas e cookies não são impressos.
"""

import argparse
import calendar
import json
import sys
import uuid
from datetime import date, timedelta
from http.cookiejar import CookieJar
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import HTTPCookieProcessor, Request, build_opener


class SmokeFailure(Exception):
    pass


def check(condition, label):
    if not condition:
        raise SmokeFailure(label)
    print(f"PASS: {label}", flush=True)


class Api:
    def __init__(self, base_url, name, email, password):
        self.base_url = base_url
        self.name = name
        self.email = email
        self.password = password
        self.cookies = CookieJar()
        self.opener = build_opener(HTTPCookieProcessor(self.cookies))
        self.resources = []

    def request(self, method, path, payload=None, expected=200):
        data = None if payload is None else json.dumps(payload).encode("utf-8")
        headers = {"Accept": "application/json"}
        if data is not None:
            headers["Content-Type"] = "application/json"
        request = Request(self.base_url + "/api" + path, data, headers, method=method)
        try:
            response = self.opener.open(request, timeout=15)
        except HTTPError as error:
            response = error
        except (URLError, TimeoutError) as error:
            raise SmokeFailure(f"{method} {path}: API indisponível") from error
        with response:
            status = response.status
            body = response.read()
        allowed = (expected,) if isinstance(expected, int) else expected
        if status not in allowed:
            raise SmokeFailure(
                f"{method} {path}: HTTP {status}; esperado {allowed}"
            )
        if status == 204:
            if body:
                raise SmokeFailure(f"{method} {path}: HTTP 204 com corpo")
            return None
        try:
            return json.loads(body)
        except (ValueError, UnicodeDecodeError) as error:
            raise SmokeFailure(f"{method} {path}: resposta não é JSON válido") from error

    def login(self):
        self.request(
            "POST", "/auth/login",
            {"email": self.email, "password": self.password}, expected=204,
        )

    def create(self, collection, payload):
        result = self.request("POST", "/" + collection, payload, expected=201)
        identifier = result.get("id")
        if type(identifier) is not int or identifier <= 0:
            raise SmokeFailure(f"POST /{collection}: id gerado inválido")
        self.resources.append(f"/{collection}/{identifier}")
        return result


def expect_error(api, method, path, status, code, payload=None):
    result = api.request(method, path, payload, expected=status)
    if result.get("error", {}).get("code") != code:
        raise SmokeFailure(f"{method} {path}: código de erro incompatível")


def query(path, **parameters):
    return path + "?" + urlencode(parameters)


def run_smoke(base_url, accounts):
    run_id = uuid.uuid4().hex
    for label in ("A", "B"):
        api = Api(
            base_url, f"Smoke {label} {run_id}",
            f"smoke-{label.lower()}-{run_id}@example.com", uuid.uuid4().hex,
        )
        health = api.request("GET", "/health")
        check(health["status"] == "ok", f"API saudável para conta {label}")
        expect_error(api, "GET", "/users/me", 401, "unauthorized")
        api.request("POST", "/auth/register", {
            "name": api.name, "email": api.email, "password": api.password,
        }, expected=201)
        accounts.append(api)
        api.login()
        check(
            any(cookie.name == "vp_session" for cookie in api.cookies),
            f"cadastro e login da conta {label} com cookie de sessão",
        )
    alice, bob = accounts
    alice_profile = alice.request("GET", "/users/me")
    bob_profile = bob.request("GET", "/users/me")
    check(
        set(alice_profile) == set(bob_profile) == {"id", "name", "email"}
        and alice_profile["email"] == alice.email
        and bob_profile["email"] == bob.email
        and alice_profile["id"] != bob_profile["id"],
        "perfis próprios, distintos e sem credenciais",
    )
    renamed = alice.request("PATCH", "/users/me", {"name": "Smoke A atualizado"})
    check(
        renamed == {**alice_profile, "name": "Smoke A atualizado"},
        "PATCH parcial do perfil preserva id e e-mail",
    )
    expect_error(alice, "PATCH", "/users/me", 409, "conflict", {
        "name": "Não deve persistir", "email": bob.email,
    })
    expect_error(alice, "PATCH", "/users/me", 400, "validation_error", {
        "user_id": bob_profile["id"],
    })
    check(alice.request("GET", "/users/me") == renamed,
          "colisão 409 e tentativa de trocar dono não alteram o perfil")
    old_email = alice.email
    new_email = f"smoke-a-updated-{run_id}@example.com"
    updated = alice.request("PATCH", "/users/me", {"email": new_email})
    alice.email = new_email
    check(updated == {**renamed, "email": new_email}
          and alice.request("GET", "/auth/me") == updated,
          "novo e-mail sincronizado no perfil e na sessão")
    alice.request("POST", "/auth/logout", expected=204)
    expect_error(alice, "GET", "/users/me", 401, "unauthorized")
    expect_error(alice, "POST", "/auth/login", 401, "invalid_credentials", {
        "email": old_email, "password": alice.password,
    })
    alice.login()
    check(alice.request("GET", "/users/me") == updated
          and bob.request("GET", "/users/me") == bob_profile,
          "login com novo e-mail preserva senha e conta B")

    empty_dashboard = alice.request("GET", "/dashboard")
    anchor = date.fromisoformat(empty_dashboard["start_date"])
    iso_date = anchor.isoformat()
    check(empty_dashboard["end_date"] == iso_date
          and empty_dashboard["tasks_total"] == 0
          and empty_dashboard["goals_total"] == 0,
          "dashboard inicial vazio usa o dia civil do servidor")
    goal_payload = {
        "description": "Smoke meta", "category": "Study",
        "period": "Weekly", "reference_date": iso_date,
    }
    task_payload = {
        "description": "Smoke tarefa", "category": "Study", "date": iso_date,
        "time_slot": {"start": 480, "end": 540}, "priority": "High",
    }
    reminder_payload = {
        "description": "Smoke lembrete", "category": "Study", "date": iso_date,
        "time_slot": {"start": 660, "end": 690},
        "type": "Study", "recurrence": "Daily",
    }
    alice_goal = alice.create("goals", goal_payload)
    alice_task = alice.create("tasks", task_payload)
    overlapping = alice.create("tasks", {
        **task_payload, "description": "Smoke sobreposição",
        "time_slot": {"start": 510, "end": 570},
    })
    alice_reminder = alice.create("reminders", reminder_payload)
    bob_goal = bob.create("goals", {**goal_payload, "category": "Work"})
    bob_task = bob.create("tasks", {**task_payload, "category": "Work"})
    bob_reminder = bob.create("reminders", {
        **reminder_payload, "category": "Work", "recurrence": "Once",
    })
    check(alice_goal["status"] == "In Progress"
          and alice_task["status"] == "Pending",
          "criação de metas, tarefas e lembretes com estados iniciais corretos")

    for api, owned in ((alice, (alice_goal, alice_task, alice_reminder)),
                       (bob, (bob_goal, bob_task, bob_reminder))):
        for collection, resource in zip(("goals", "tasks", "reminders"), owned):
            check(api.request("GET", f"/{collection}/{resource['id']}") == resource,
                  f"leitura do próprio recurso {collection}")
    alice_goal = alice.request("PATCH", f"/goals/{alice_goal['id']}", {
        "description": "Smoke meta atualizada",
    })
    alice_goal = alice.request("PATCH", f"/goals/{alice_goal['id']}/status", {
        "status": "Completed",
    })
    alice_task = alice.request("PATCH", f"/tasks/{alice_task['id']}", {
        "description": "Smoke tarefa atualizada", "priority": "Low",
    })
    alice_task = alice.request("PATCH", f"/tasks/{alice_task['id']}/status", {
        "status": "Executed",
    })
    check(alice_goal["description"] == "Smoke meta atualizada"
          and alice_goal["status"] == "Completed"
          and alice_task["description"] == "Smoke tarefa atualizada"
          and alice_task["priority"] == "Low"
          and alice_task["status"] == "Executed",
          "edição e mudança de status de meta e tarefa")

    conflict_path = query("/tasks/conflicts", date=iso_date)
    pairs = alice.request("GET", conflict_path)["conflicts"]
    check(len(pairs) == 1
          and {pairs[0]["first_task_id"], pairs[0]["second_task_id"]}
          == {alice_task["id"], overlapping["id"]}
          and bob.request("GET", conflict_path) == {"conflicts": []},
          "conflito real calculado no backend e isolado por conta")
    alice.request("PATCH", f"/tasks/{overlapping['id']}/status", {"status": "Cancelled"})
    check(alice.request("GET", conflict_path) == {"conflicts": []},
          "tarefa cancelada não participa de conflitos")
    alice.request("PATCH", f"/tasks/{overlapping['id']}/status", {"status": "Pending"})

    def occurrences(api, days):
        return api.request("GET", query(
            "/reminders", start_date=iso_date,
            end_date=(anchor + timedelta(days=days)).isoformat(),
        ))

    daily = occurrences(alice, 2)
    check({item["occurrence_date"] for item in daily}
          == {(anchor + timedelta(days=offset)).isoformat() for offset in range(3)}
          and len(daily) == 3
          and all(item["reminder"]["id"] == alice_reminder["id"]
                  and item["reminder"]["date"] == iso_date for item in daily),
          "recorrência diária expandida mantém a data-base persistida")
    reminder_update = {**reminder_payload, "description": "Smoke lembrete atualizado",
                       "recurrence": "Weekly"}
    alice_reminder = alice.request("PUT", f"/reminders/{alice_reminder['id']}",
                                  reminder_update)
    weekly = occurrences(alice, 14)
    check(alice_reminder == {**reminder_update, "id": alice_reminder["id"]}
          and len(weekly) == 3
          and {item["occurrence_date"] for item in weekly}
          == {(anchor + timedelta(days=offset)).isoformat() for offset in (0, 7, 14)},
          "edição completa do lembrete altera a expansão para semanal")

    goals_path = query("/goals", period="weekly", date=iso_date)
    for api, task_ids, goal_id, reminder_id in (
        (alice, {alice_task["id"], overlapping["id"]}, alice_goal["id"], alice_reminder["id"]),
        (bob, {bob_task["id"]}, bob_goal["id"], bob_reminder["id"]),
    ):
        check({item["id"] for item in api.request("GET", "/tasks")} == task_ids
              and {item["id"] for item in api.request("GET", goals_path)} == {goal_id}
              and {item["reminder"]["id"] for item in occurrences(api, 14)} == {reminder_id},
              "listagens de tarefas, metas e ocorrências isoladas por conta")
    for intruder, owner, resources in (
        (bob, alice, (alice_goal, alice_task, alice_reminder)),
        (alice, bob, (bob_goal, bob_task, bob_reminder)),
    ):
        for collection, resource in zip(("goals", "tasks", "reminders"), resources):
            path = f"/{collection}/{resource['id']}"
            expect_error(intruder, "GET", path, 404, "not_found")
            method = "PUT" if collection == "reminders" else "PATCH"
            payload = reminder_update if collection == "reminders" else {"description": "Negado"}
            expect_error(intruder, method, path, 404, "not_found", payload)
            expect_error(intruder, "DELETE", path, 404, "not_found")
            if collection != "reminders":
                status = "Completed" if collection == "goals" else "Executed"
                expect_error(intruder, "PATCH", path + "/status", 404, "not_found", {"status": status})
            check(owner.request("GET", path) == resource,
                  f"acesso e mutações de outra conta negados sem alterar {collection}")

    week_start = anchor - timedelta(days=anchor.weekday())
    periods = {
        "weekly": (week_start, week_start + timedelta(days=6)),
        "monthly": (anchor.replace(day=1), anchor.replace(day=calendar.monthrange(anchor.year, anchor.month)[1])),
        "yearly": (anchor.replace(month=1, day=1), anchor.replace(month=12, day=31)),
    }
    for api, tasks, completed, executed, category in (
        (alice, 2, 1, 1, "Study"), (bob, 1, 0, 0, "Work"),
    ):
        for period, (start, end) in periods.items():
            report = api.request("GET", query("/reports", period=period, date=iso_date))
            check(report["start_date"] == start.isoformat()
                  and report["end_date"] == end.isoformat()
                  and report["tasks_total"] == tasks and report["goals_total"] == 1
                  and report["goals_completed"] == completed
                  and report["tasks_executed"] == executed
                  and report["goals_ratio"] == completed
                  and report["tasks_ratio"] == executed / tasks
                  and {item["label"] for item in report["task_categories"]} == {category}
                  and {item["label"] for item in report["goal_categories"]} == {category},
                  f"relatório {period} com datas, métricas e categorias isoladas")
        dashboard = api.request("GET", "/dashboard")
        check(dashboard["start_date"] == iso_date and dashboard["end_date"] == iso_date
              and dashboard["tasks_total"] == tasks and dashboard["goals_total"] == 1
              and dashboard["tasks_executed"] == executed
              and dashboard["goals_completed"] == completed,
              "dashboard diário mostra somente os dados da própria conta")

    for api in accounts:
        for path in list(reversed(api.resources)):
            api.request("DELETE", path, expected=204)
            api.resources.remove(path)
            expect_error(api, "GET", path, 404, "not_found")
        check(api.request("GET", "/tasks") == []
              and api.request("GET", goals_path) == [] and occurrences(api, 14) == [],
              "exclusões removem apenas os recursos sintéticos criados")
        api.request("POST", "/auth/logout", expected=204)
        for path in ("/auth/me", "/users/me", "/tasks", "/dashboard", goals_path):
            expect_error(api, "GET", path, 401, "unauthorized")
        check(True, "logout invalida o acesso autenticado com HTTP 401")


def cleanup(accounts):
    success = True
    for api in accounts:
        try:
            if api.resources:
                api.login()
        except (SmokeFailure, OSError, ValueError) as error:
            success = False
            print(f"FAIL: sessão indisponível para limpeza ({type(error).__name__})",
                  file=sys.stderr)
            continue
        for path in list(reversed(api.resources)):
            try:
                api.request("DELETE", path, expected=(204, 404))
                api.resources.remove(path)
            except (SmokeFailure, OSError, ValueError) as error:
                success = False
                print(f"FAIL: limpeza de {path} incompleta ({type(error).__name__})",
                      file=sys.stderr)
        try:
            api.request("POST", "/auth/logout", expected=(204, 401))
        except (SmokeFailure, OSError, ValueError) as error:
            success = False
            print(f"FAIL: logout de limpeza incompleto ({type(error).__name__})",
                  file=sys.stderr)
    return success


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", required=True,
                        help="Origem da API, sem /api; use somente um banco descartável")
    args = parser.parse_args()
    parsed = urlsplit(args.base_url)
    if (parsed.scheme not in ("http", "https") or not parsed.netloc
            or parsed.path not in ("", "/") or parsed.query or parsed.fragment
            or parsed.username or parsed.password):
        parser.error("--base-url deve ser uma origem HTTP(S), sem caminho ou credenciais")
    accounts = []
    success = False
    print("Banco descartável obrigatório: duas contas sintéticas permanecerão cadastradas.",
          flush=True)
    try:
        run_smoke(args.base_url.rstrip("/"), accounts)
        success = True
    except SmokeFailure as error:
        print(f"FAIL: {error}", file=sys.stderr)
    except (OSError, ValueError, TypeError, KeyError, AttributeError) as error:
        print(f"FAIL: resposta incompatível ou falha de transporte ({type(error).__name__})",
              file=sys.stderr)
    finally:
        success = cleanup(accounts) and success
    if success:
        print("PASS: smoke completo; recursos removidos, duas contas sintéticas mantidas.")
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
