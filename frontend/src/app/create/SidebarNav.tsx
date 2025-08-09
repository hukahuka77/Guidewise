import React from "react";
import { Home, Wifi, ParkingCircle, DoorOpen, CalendarCheck2 } from "lucide-react";

const navItems = [
  { label: "Check-in Info", icon: <DoorOpen />, section: "checkin" },
  { label: "Property Details", icon: <Home />, section: "property" },
  { label: "Host Info", icon: <Home />, section: "hostinfo" },
  { label: "Wifi", icon: <Wifi />, section: "wifi" },
  { label: "Food", icon: <Home />, section: "food" },
  { label: "Activities", icon: <CalendarCheck2 />, section: "activities" },
  { label: "Rules", icon: <ParkingCircle />, section: "rules" },
  { label: "Checkout Info", icon: <CalendarCheck2 />, section: "checkout" },
];

interface SidebarNavProps {
  currentSection: string;
  onSectionChange: (section: string) => void;
  visitedMaxIndex: number;
  allVisited: boolean;
}

import { useContext } from "react";

interface NavGuardContextProps {
  locationFilled: boolean;
}

export const NavGuardContext = React.createContext<NavGuardContextProps>({ locationFilled: true });

export default function SidebarNav({ currentSection, onSectionChange, visitedMaxIndex, allVisited }: SidebarNavProps) {
  return (
    <nav className="h-full w-56 bg-[oklch(0.6923_0.22_21.05)] text-white flex flex-col py-8 px-4 shadow-lg">
      <div className="mb-8 text-2xl font-bold tracking-tight">Guidebook</div>
      <NavGuardContext.Consumer>
        {({ locationFilled }) => (
          <ul className="flex flex-col gap-4">
            {navItems.map((item, idx) => {
              const lockedByLocation = !locationFilled && item.section !== "checkin";
              const lockedByProgress = !allVisited && idx > (visitedMaxIndex + 1);
              const isDisabled = lockedByLocation || lockedByProgress;
              return (
                <li
                  key={item.section}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${currentSection === item.section ? "bg-white/20" : isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-white/10"}`}
                  onClick={() => {
                    if (!isDisabled) onSectionChange(item.section);
                  }}
                  title={isDisabled ? (lockedByLocation ? "Fill out Location to continue" : "Please complete previous sections first") : undefined}
                  aria-disabled={isDisabled}
                >
                  <span className="w-6 h-6">{item.icon}</span>
                  <span className="font-medium">{item.label}</span>
                </li>
              );
            })}
          </ul>
        )}
      </NavGuardContext.Consumer>
    </nav>
  );
}
