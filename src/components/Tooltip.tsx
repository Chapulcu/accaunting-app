import { useState, useRef, useEffect } from 'react'
import type { ReactNode } from 'react'
import { HelpCircle } from 'lucide-react'

interface TooltipProps {
  content: string
  children?: ReactNode
  icon?: boolean
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto'
}

export default function Tooltip({
  content,
  children,
  icon = true,
  position = 'auto'
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [calculatedPosition, setCalculatedPosition] = useState<'top' | 'bottom' | 'left' | 'right'>(position === 'auto' ? 'bottom' : position as 'top' | 'bottom' | 'left' | 'right')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (position === 'auto' && isVisible && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const viewportHeight = window.innerHeight

      // Eğer elemanın üst kısmında yeterli alan varsa yukarı, yoksa aşağı aç
      if (rect.top > viewportHeight / 2) {
        setCalculatedPosition('top')
      } else {
        setCalculatedPosition('bottom')
      }
    }
  }, [isVisible, position])

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-gray-900 dark:border-t-white',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-gray-900 dark:border-b-white',
    left: 'left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-gray-900 dark:border-l-white',
    right: 'right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-gray-900 dark:border-r-white',
  }

  const effectivePosition = position === 'auto' ? calculatedPosition : position

  return (
    <div className="relative inline-block" ref={containerRef}>
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="cursor-help"
      >
        {children || (
          icon && (
            <HelpCircle className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" />
          )
        )}
      </div>

      {isVisible && (
        <div
          className={`absolute z-50 ${positionClasses[effectivePosition]}`}
          role="tooltip"
        >
          <div className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs rounded-lg py-2 px-3 shadow-lg max-w-sm w-64">
            {content}
          </div>
          <div
            className={`absolute w-0 h-0 border-4 ${arrowClasses[effectivePosition]}`}
          />
        </div>
      )}
    </div>
  )
}
