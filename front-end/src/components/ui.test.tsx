import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { DangerConfirm, Select, Table } from "./ui";

const dialogPrototype = HTMLDialogElement.prototype;
const originalShowModal = Object.getOwnPropertyDescriptor(
  dialogPrototype,
  "showModal",
);
const originalClose = Object.getOwnPropertyDescriptor(dialogPrototype, "close");

// jsdom não implementa a abertura e o fechamento do dialog nativo.
beforeAll(() => {
  Object.defineProperties(dialogPrototype, {
    showModal: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.setAttribute("open", "");
      },
    },
    close: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.removeAttribute("open");
      },
    },
  });
});

afterAll(() => {
  if (originalShowModal)
    Object.defineProperty(dialogPrototype, "showModal", originalShowModal);
  else Reflect.deleteProperty(dialogPrototype, "showModal");
  if (originalClose)
    Object.defineProperty(dialogPrototype, "close", originalClose);
  else Reflect.deleteProperty(dialogPrototype, "close");
});

describe("DangerConfirm", () => {
  it("requires confirmation before running the destructive action", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<DangerConfirm onConfirm={onConfirm} />);

    await user.click(screen.getByRole("button", { name: "Excluir" }));

    expect(onConfirm).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", { name: "Confirmar exclusão" });
    expect(dialog).toBeVisible();
    expect(
      within(dialog).getByRole("button", { name: "Confirmar exclusão" }),
    ).toBeVisible();
    expect(
      within(dialog).getByRole("button", { name: "Cancelar" }),
    ).toBeVisible();
  });

  it("cancels confirmation without running the action", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<DangerConfirm onConfirm={onConfirm} />);
    await user.click(screen.getByRole("button", { name: "Excluir" }));

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Excluir" })).toBeVisible();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Confirmar exclusão" }),
    ).toBeNull();
  });

  it("runs the confirmed action once and resets the confirmation state", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <DangerConfirm
        onConfirm={onConfirm}
        label="Remover tarefa"
        confirmLabel="Sim, remover"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Remover tarefa" }));

    await user.click(screen.getByRole("button", { name: "Sim, remover" }));

    expect(onConfirm).toHaveBeenCalledExactlyOnceWith();
    expect(
      screen.getByRole("button", { name: "Remover tarefa" }),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Sim, remover" })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("componentes compartilhados sem dependência de domínio", () => {
  it("Select mantém rótulo acessível e permite escolher uma opção", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <label>
        Ordenar por
        <Select defaultValue="date" onChange={onChange}>
          <option value="date">Data</option>
          <option value="name">Nome</option>
        </Select>
      </label>,
    );
    const select = screen.getByRole("combobox", { name: "Ordenar por" });

    await user.selectOptions(select, "name");

    expect(select).toHaveValue("name");
    expect(
      screen.getByRole("option", { name: "Nome", selected: true }),
    ).toBeVisible();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("Table oferece nome e cabeçalhos acessíveis e preserva ações das linhas", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(
      <Table caption="Itens de exemplo" headings={["Nome", "Ações"]}>
        <tr>
          <td>Primeiro item</td>
          <td>
            <button type="button" onClick={onEdit}>
              Editar item
            </button>
          </td>
        </tr>
      </Table>,
    );
    const table = screen.getByRole("table", { name: "Itens de exemplo" });

    await user.click(
      within(table).getByRole("button", { name: "Editar item" }),
    );

    expect(
      within(table).getByRole("columnheader", { name: "Nome" }),
    ).toBeVisible();
    expect(
      within(table).getByRole("columnheader", { name: "Ações" }),
    ).toBeVisible();
    expect(
      within(table).getByRole("cell", { name: "Primeiro item" }),
    ).toBeVisible();
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
