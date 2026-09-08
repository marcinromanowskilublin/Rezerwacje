import { createContext, useContext, useState, ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { VisitType } from '../../types';

interface BookingState {
  visitType: VisitType | null;
  date: string | null;
  time: string | null;
  patient: {
    name: string;
    email: string;
    phone: string;
  };
  paymentMethod?: string;
}

interface BookingContextType {
  state: BookingState;
  updateState: (updates: Partial<BookingState>) => void;
  reset: () => void;
}

const initialState: BookingState = {
  visitType: null,
  date: null,
  time: null,
  patient: {
    name: '',
    email: '',
    phone: '',
  }
};

const BookingContext = createContext<BookingContextType | undefined>(undefined);

export function BookingProvider() {
  const [state, setState] = useState<BookingState>(initialState);

  const updateState = (updates: Partial<BookingState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const reset = () => setState(initialState);

  return (
    <BookingContext.Provider value={{ state, updateState, reset }}>
      <Outlet />
    </BookingContext.Provider>
  );
}

export function useBooking() {
  const context = useContext(BookingContext);
  if (context === undefined) {
    throw new Error('useBooking must be used within a BookingProvider');
  }
  return context;
}
