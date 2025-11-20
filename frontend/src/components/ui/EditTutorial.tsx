"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  targetSelector: string; // CSS selector for the element to highlight
  position: "top" | "bottom" | "left" | "right";
  showArrow?: boolean;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    title: "Welcome to Your Guidebook Editor!",
    description: "Let's take a quick tour to show you how to customize your guidebook. You can skip this anytime.",
    targetSelector: "",
    position: "top",
    showArrow: false,
  },
  {
    id: "sidebar",
    title: "Navigation Sidebar",
    description: "Click on any section to edit its content. Sections are organized in the order they'll appear in your guidebook.",
    targetSelector: "[data-tutorial='sidebar']",
    position: "right",
    showArrow: true,
  },
  {
    id: "include-exclude",
    title: "Include or Exclude Sections",
    description: "Use the + and − buttons to add or remove sections from your guidebook. Drag sections to reorder them.",
    targetSelector: "[data-tutorial='sidebar-included']",
    position: "right",
    showArrow: true,
  },
  {
    id: "excluded-sections",
    title: "Excluded Sections",
    description: "Sections you exclude are moved here. Click the + button to add them back anytime.",
    targetSelector: "[data-tutorial='sidebar-excluded']",
    position: "right",
    showArrow: true,
  },
  {
    id: "edit-content",
    title: "Edit Section Content",
    description: "Fill in the details for each section. Your changes are saved automatically when you publish.",
    targetSelector: "[data-tutorial='content-area']",
    position: "left",
    showArrow: false,
  },
  {
    id: "publish",
    title: "Publish Your Changes",
    description: "When you're ready, click 'Publish Changes' to save and generate your guidebook. You can preview and share it with your guests!",
    targetSelector: "[data-tutorial='publish-button']",
    position: "left",
    showArrow: true,
  },
];

interface EditTutorialProps {
  onComplete: () => void;
}

export default function EditTutorial({ onComplete }: EditTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const currentStepData = TUTORIAL_STEPS[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === TUTORIAL_STEPS.length - 1;

  // Update target element position
  useEffect(() => {
    if (!currentStepData.targetSelector) {
      setTargetRect(null);
      return;
    }

    const updatePosition = () => {
      const element = document.querySelector(currentStepData.targetSelector);
      if (element) {
        setTargetRect(element.getBoundingClientRect());
      }
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition);
    };
  }, [currentStepData]);

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    onComplete();
  };




  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Overlay with spotlight */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Dark overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70"
            style={{
              clipPath: targetRect
                ? `polygon(
                    0% 0%,
                    0% 100%,
                    ${targetRect.left - 8}px 100%,
                    ${targetRect.left - 8}px ${targetRect.top - 8}px,
                    ${targetRect.right + 8}px ${targetRect.top - 8}px,
                    ${targetRect.right + 8}px ${targetRect.bottom + 8}px,
                    ${targetRect.left - 8}px ${targetRect.bottom + 8}px,
                    ${targetRect.left - 8}px 100%,
                    100% 100%,
                    100% 0%
                  )`
                : "none",
            }}
          />

          {/* Highlighted border around target */}
          {targetRect && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute border-4 border-[oklch(0.6923_0.22_21.05)] rounded-lg pointer-events-none"
              style={{
                top: `${targetRect.top - 8}px`,
                left: `${targetRect.left - 8}px`,
                width: `${targetRect.width + 16}px`,
                height: `${targetRect.height + 16}px`,
                boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.7)",
              }}
            />
          )}
        </div>

        {/* Tooltip - centered using flexbox */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="bg-white rounded-xl shadow-2xl p-6 w-[400px] z-10 relative"
        >
          {/* Progress indicator */}
          <div className="flex items-center gap-1 mb-4">
            {TUTORIAL_STEPS.map((_, index) => (
              <div
                key={index}
                className={`h-1.5 rounded-full transition-all ${index === currentStep ? "bg-[oklch(0.6923_0.22_21.05)] w-8" : index < currentStep ? "bg-[oklch(0.6923_0.22_21.05)]/50 w-1.5" : "bg-gray-300 w-1.5"
                  }`}
              />
            ))}
          </div>

          {/* Content */}
          <h3 className="text-xl font-bold text-gray-900 mb-2">{currentStepData.title}</h3>
          <p className="text-gray-600 mb-6">{currentStepData.description}</p>

          {/* Navigation buttons */}
          <div className="flex items-center justify-between">
            <button type="button" onClick={handleSkip} className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
              Skip Tutorial
            </button>

            <div className="flex items-center gap-2">
              {!isFirstStep && (
                <button
                  type="button"
                  onClick={handlePrevious}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Previous
                </button>
              )}
              <button
                type="button"
                onClick={handleNext}
                className="px-6 py-2 bg-[oklch(0.6923_0.22_21.05)] text-white rounded-lg hover:opacity-90 transition-opacity font-medium"
              >
                {isLastStep ? "Get Started" : "Next"}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
