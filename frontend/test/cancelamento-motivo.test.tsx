import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ModalCancelarComanda, FRASE_CANCELAMENTO } from '../src/components/ui/ModalCancelarComanda';
import { comandasApi, cancelarComanda } from '../src/services/comandas';
import { apiClient } from '../src/services/apiClient';
import { useCancelarComanda } from '../src/hooks/useComandas';
import { renderHook, act } from '@testing-library/react';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('Story 2.4.4 — Frontend: Seleção de Motivo e Cancelamento de Comanda', () => {
  let spyPost: any;

  beforeEach(() => {
    spyPost = vi.spyOn(apiClient, 'post').mockResolvedValue({ id: 5, status: 'cancelada' });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('comandasApi.cancelar e cancelarComanda enviam { motivo } no body', async () => {
    await comandasApi.cancelar(5, 'Desistência do cliente');
    expect(spyPost).toHaveBeenCalledWith('/comandas/5/cancelar', {
      motivo: 'Desistência do cliente',
    });

    await cancelarComanda(5, 'Erro de digitação do garçom');
    expect(spyPost).toHaveBeenCalledWith('/comandas/5/cancelar', {
      motivo: 'Erro de digitação do garçom',
    });

    await comandasApi.cancelar(5);
    expect(spyPost).toHaveBeenCalledWith('/comandas/5/cancelar', {});
  });

  it('hook useCancelarComanda aceita { comandaId, motivo } e repassa para API', async () => {
    const { result } = renderHook(() => useCancelarComanda(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        comandaId: 10,
        motivo: 'Mesa solicitou troca de salão',
      });
    });

    expect(spyPost).toHaveBeenCalledWith('/comandas/10/cancelar', {
      motivo: 'Mesa solicitou troca de salão',
    });
  });

  it('ModalCancelarComanda unificado exige seleção de motivo e frase antes de liberar confirmação', () => {
    const onConfirmar = vi.fn();
    const onClose = vi.fn();

    render(
      <ModalCancelarComanda
        isOpen={true}
        mesa={14}
        onClose={onClose}
        onConfirmar={onConfirmar}
      />
    );

    expect(screen.getByText(/Comanda da Mesa 14/i)).toBeTruthy();

    const btnConfirmar = screen.getByTestId('btn-confirmar-cancelamento');
    expect(btnConfirmar.hasAttribute('disabled')).toBe(true);

    // Seleciona motivo "Erro de digitação do garçom"
    const radioErro = screen.getByRole('radio', { name: /Erro de digitação do garçom/i });
    fireEvent.click(radioErro);

    // Digita frase incompleta
    const inputFrase = screen.getByPlaceholderText(FRASE_CANCELAMENTO);
    fireEvent.change(inputFrase, { target: { value: 'cancelar' } });
    expect(btnConfirmar.hasAttribute('disabled')).toBe(true);

    // Digita frase completa
    fireEvent.change(inputFrase, { target: { value: 'cancelar comanda' } });
    expect(btnConfirmar.hasAttribute('disabled')).toBe(false);

    // Submete
    fireEvent.click(btnConfirmar);
    expect(onConfirmar).toHaveBeenCalledWith('Erro de digitação do garçom');
  });

  it('ModalCancelarComanda unificado suporta motivo "Outro" com descrição personalizada', () => {
    const onConfirmar = vi.fn();

    render(
      <ModalCancelarComanda
        isOpen={true}
        mesa="20"
        onClose={vi.fn()}
        onConfirmar={onConfirmar}
      />
    );

    const radioOutro = screen.getByRole('radio', { name: /Outro/i });
    fireEvent.click(radioOutro);

    const inputOutro = screen.getByPlaceholderText(/Descreva brevemente o motivo/i);
    fireEvent.change(inputOutro, { target: { value: 'Cliente esqueceu carteira' } });

    const inputFrase = screen.getByPlaceholderText(FRASE_CANCELAMENTO);
    fireEvent.change(inputFrase, { target: { value: 'cancelar comanda' } });

    const btnConfirmar = screen.getByTestId('btn-confirmar-cancelamento');
    fireEvent.click(btnConfirmar);

    expect(onConfirmar).toHaveBeenCalledWith('Cliente esqueceu carteira');
  });
});
