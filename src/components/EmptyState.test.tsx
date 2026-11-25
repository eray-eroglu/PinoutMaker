import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { EmptyState } from './EmptyState';
import { LanguageProvider } from '../i18n/LanguageProvider';

const setup = (withLibrary = true) => {
  const props = {
    onImportImage: vi.fn(),
    onOpenLibrary: withLibrary ? vi.fn() : undefined,
    onLoadProject: vi.fn(),
  };
  render(<EmptyState {...props} />);
  return props;
};

const dropFiles = (files: File[]) => {
  const zone = screen.getByTestId('empty-state');
  const dataTransfer = { files, types: ['Files'], dropEffect: 'none' };
  fireEvent.dragEnter(zone, { dataTransfer });
  fireEvent.dragOver(zone, { dataTransfer });
  fireEvent.drop(zone, { dataTransfer });
};

describe('EmptyState', () => {
  it('shows the title and the three options', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'Start your pinout' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Import an image/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Boardoza Library/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open a project/ })).toBeInTheDocument();
  });

  it('imports the image chosen in the file picker', () => {
    const props = setup();
    const input = screen.getByTestId('empty-state-file-input') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click');
    fireEvent.click(screen.getByRole('button', { name: /Import an image/ }));
    expect(clickSpy).toHaveBeenCalled();

    const file = new File(['x'], 'board.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(props.onImportImage).toHaveBeenCalledWith(file);
  });

  it('opens the library and loads a project', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: /Boardoza Library/ }));
    expect(props.onOpenLibrary).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /Open a project/ }));
    expect(props.onLoadProject).toHaveBeenCalledTimes(1);
  });

  it('hides the library card without onOpenLibrary', () => {
    setup(false);
    expect(screen.queryByRole('button', { name: /Boardoza Library/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('highlights while dragging a file over it', () => {
    setup();
    const zone = screen.getByTestId('empty-state');
    fireEvent.dragEnter(zone, { dataTransfer: { files: [], types: ['Files'] } });
    expect(screen.getByText('Drop the image to start')).toBeInTheDocument();
    fireEvent.dragLeave(zone);
    expect(screen.queryByText('Drop the image to start')).not.toBeInTheDocument();
  });

  it('imports the first image file dropped on it', () => {
    const props = setup();
    const text = new File(['x'], 'notes.txt', { type: 'text/plain' });
    const image = new File(['x'], 'board.jpg', { type: 'image/jpeg' });
    dropFiles([text, image]);
    expect(props.onImportImage).toHaveBeenCalledTimes(1);
    expect(props.onImportImage).toHaveBeenCalledWith(image);
    expect(screen.queryByText('Drop the image to start')).not.toBeInTheDocument();
  });

  it('ignores a dropped file that is not an image', () => {
    const props = setup();
    dropFiles([new File(['{}'], 'project.json', { type: 'application/json' })]);
    expect(props.onImportImage).not.toHaveBeenCalled();
  });

  it('renders in Turkish', () => {
    render(
      <LanguageProvider initial='tr'>
        <EmptyState onImportImage={vi.fn()} onOpenLibrary={vi.fn()} onLoadProject={vi.fn()} />
      </LanguageProvider>
    );
    expect(screen.getByRole('heading', { name: 'Pinout çizimine başlayın' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Görsel içe aktar/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Boardoza Kütüphanesi/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Proje aç/ })).toBeInTheDocument();
    expect(screen.queryByText('Start your pinout')).not.toBeInTheDocument();
  });
});
