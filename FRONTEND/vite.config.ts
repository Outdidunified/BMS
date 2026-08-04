import tailwindcss from "@tailwindcss/vite";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig, loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), "");
	const base = env.VITE_APP_PUBLIC_PATH || "/";
	const isProduction = mode === "production";

	return {
		base,
		plugins: [
			react(),
			vanillaExtractPlugin({
				identifiers: ({ debugId }) => `${debugId}`,
			}),
			tailwindcss(),
			tsconfigPaths(),

			isProduction &&
				visualizer({
					open: true,
					gzipSize: true,
					brotliSize: true,
					template: "treemap",
				}),
		].filter(Boolean),

		server: {
			open: "/dashboard",
			host: true,
			port: 3001,
			proxy: {
				"/api": {
					target: "http://localhost:8070",
					changeOrigin: true,
					rewrite: (path) => path.replace(/^\/api/, ""),
					secure: false,
				},
				"/ws": {
					target: "ws://localhost:8071",
					ws: true,
					changeOrigin: true,
					rewrite: (path) => path.replace(/^\/ws/, ""),
					secure: false,
				},
			},
		},

		build: {
			target: "esnext",
			minify: false, // Disable minification to speed up build
			sourcemap: false, // Disable sourcemaps to reduce memory usage
			cssCodeSplit: false, // Disable CSS splitting to simplify build
			chunkSizeWarningLimit: 5000, // Increase chunk size limit
			rollupOptions: {
				output: {
					manualChunks: undefined, // Disable manual chunking to simplify
				},
			},
		},

		optimizeDeps: {
			include: ["react", "react-dom", "react-router", "antd", "axios", "dayjs"],
			exclude: ["@iconify/react"],
		},

		esbuild: {
			drop: isProduction ? ["console", "debugger"] : [],
			legalComments: "none",
			target: "esnext",
		},
	};
});