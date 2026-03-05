import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
  	container: {
  		center: true,
  		padding: '2rem',
  		screens: {
  			'2xl': '1400px'
  		}
  	},
  	extend: {
  		colors: {
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
   			},
   			pink: {
   				DEFAULT: 'hsl(330 81% 60%)',
   				foreground: 'hsl(210 40% 98%)'
   			},
   			amber: {
   				DEFAULT: 'hsl(38 92% 50%)',
   				foreground: 'hsl(229 60% 10%)'
   			},
   			cyan: {
   				DEFAULT: 'hsl(189 94% 43%)',
   				foreground: 'hsl(229 60% 10%)'
   			},
   			emerald: {
   				DEFAULT: 'hsl(160 84% 39%)',
   				foreground: 'hsl(210 40% 98%)'
   			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
   			},
   			'glow-pulse': {
   				'0%, 100%': {
   					opacity: '1'
   				},
   				'50%': {
   					opacity: '0.6'
   				}
   			},
   			'float': {
   				'0%, 100%': {
   					transform: 'translateY(0)'
   				},
   				'50%': {
   					transform: 'translateY(-10px)'
   				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
   			'accordion-up': 'accordion-up 0.2s ease-out',
   			'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
   			'float': 'float 3s ease-in-out infinite'
  		},
  		fontFamily: {
  			sans: [
   				'Inter',
  				'ui-sans-serif',
  				'system-ui',
  				'-apple-system',
  				'BlinkMacSystemFont',
  				'Segoe UI',
  				'Roboto',
  				'Helvetica Neue',
  				'Arial',
  				'sans-serif'
  			],
   			display: [
   				'Space Grotesk',
   				'ui-sans-serif',
   				'system-ui',
   				'sans-serif'
  			],
  			mono: [
   				'JetBrains Mono',
  				'ui-monospace',
  				'SFMono-Regular',
  				'Menlo',
  				'Monaco',
  				'Consolas',
  				'monospace'
  			]
  		},
  		boxShadow: {
  			'2xs': 'var(--shadow-2xs)',
  			xs: 'var(--shadow-xs)',
  			sm: 'var(--shadow-sm)',
  			md: 'var(--shadow-md)',
  			lg: 'var(--shadow-lg)',
  			xl: 'var(--shadow-xl)',
   			'2xl': 'var(--shadow-2xl)',
   			'glow': 'var(--shadow-glow)'
   		},
   		backgroundImage: {
   			'gradient-cosmic': 'linear-gradient(135deg, hsl(239 84% 67%) 0%, hsl(262 60% 35%) 50%, hsl(229 60% 10%) 100%)',
   			'gradient-hero': 'linear-gradient(135deg, hsl(239 70% 65%) 0%, hsl(270 60% 50%) 50%, hsl(330 70% 70%) 100%)',
   			'gradient-ethereal': 'linear-gradient(45deg, hsl(239 84% 67%) 0%, hsl(258 90% 66%) 33%, hsl(330 81% 60%) 66%, hsl(38 92% 50%) 100%)',
   			'gradient-glass': 'linear-gradient(135deg, hsl(239 84% 67% / 0.1) 0%, hsl(258 90% 66% / 0.05) 100%)'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
