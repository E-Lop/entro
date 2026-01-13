import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from 'date-fns'
import type { Food } from './foods'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generate array of dates for the next 7 days starting from today
 * Returns dates normalized to midnight for accurate comparisons
 */
export function getNext7Days(): Date[] {
  const dates: Date[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let i = 0; i < 7; i++) {
    const date = new Date(today)
    date.setDate(today.getDate() + i)
    dates.push(date)
  }

  return dates
}

/**
 * Format date as YYYY-MM-DD for grouping (local timezone, not UTC)
 */
export function formatDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

/**
 * Group foods by expiry date
 * Returns Map<dateKey, Food[]>
 */
export function groupFoodsByDate(foods: Food[]): Map<string, Food[]> {
  const groups = new Map<string, Food[]>()

  foods.forEach(food => {
    // Normalize to YYYY-MM-DD
    const dateKey = food.expiry_date.split('T')[0]
    if (!groups.has(dateKey)) {
      groups.set(dateKey, [])
    }
    groups.get(dateKey)!.push(food)
  })

  return groups
}
