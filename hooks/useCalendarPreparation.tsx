"use client";
import { createContext, useContext } from "react";
const CalendarPreparation = createContext({ pending: false, error: "" });
export const CalendarPreparationProvider = CalendarPreparation.Provider;
export const useCalendarPreparation = () => useContext(CalendarPreparation);
