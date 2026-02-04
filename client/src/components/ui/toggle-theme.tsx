"use client"

import { useEffect, useRef, useState } from "react"
import { Moon, Sun } from "lucide-react"
import { cn } from "@/lib/utils"
import { useThemeAnimation, type AnimationType } from "@/hooks/use-theme-animation"

interface ToggleThemeProps
    extends React.ComponentPropsWithoutRef<"button"> {
    duration?: number
    animationType?: AnimationType
}

export const ToggleTheme = ({
    className,
    duration = 800,
    animationType = "swipe-left",
    ...props
}: ToggleThemeProps) => {
    const [isDark, setIsDark] = useState(false)
    const buttonRef = useRef<HTMLButtonElement>(null)

    useEffect(() => {
        const updateTheme = () => {
            setIsDark(document.documentElement.classList.contains("dark"))
        }

        // Initial theme check from localStorage
        const storedTheme = localStorage.getItem("rfp-ai-theme")
        if (storedTheme === "dark" || storedTheme === "light") {
            document.documentElement.classList.remove("light", "dark")
            document.documentElement.classList.add(storedTheme)
        } else if (storedTheme === "system") {
            const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
            document.documentElement.classList.remove("light", "dark")
            document.documentElement.classList.add(systemTheme)
        }
        
        updateTheme()

        const observer = new MutationObserver(updateTheme)
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["class"],
        })

        // Listen for system theme changes
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
        const handleSystemThemeChange = () => {
            const storedTheme = localStorage.getItem("rfp-ai-theme")
            if (storedTheme === "system") {
                const systemTheme = mediaQuery.matches ? "dark" : "light"
                document.documentElement.classList.remove("light", "dark")
                document.documentElement.classList.add(systemTheme)
                updateTheme()
            }
        }
        mediaQuery.addEventListener("change", handleSystemThemeChange)

        return () => {
            observer.disconnect()
            mediaQuery.removeEventListener("change", handleSystemThemeChange)
        }
    }, [])

    const { toggleTheme } = useThemeAnimation({
        buttonRef,
        isDark,
        setIsDark,
        duration,
        animationType,
    })

    return (
        <>
            <button
                ref={buttonRef}
                onClick={toggleTheme}
                className={cn(
                    "relative w-9 h-9 rounded-full flex items-center justify-center transition-colors duration-300",
                    className
                )}
                {...props}
            >
                <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all theme-icon-sun" />
                <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all theme-icon-moon" />
                <span className="sr-only">Toggle theme</span>
            </button>

            {/* This inline <style> block is necessary to override the default 
                view transition animation for all JS-based effects.
            */}
            {animationType !== 'flip-x-in' && (
                <style
                    dangerouslySetInnerHTML={{
                        __html: `
                            ::view-transition-old(root),
                            ::view-transition-new(root) {
                                animation: none;
                                mix-blend-mode: normal;
                            }
                        `,
                    }}
                />
            )}
        </>
    )
}
