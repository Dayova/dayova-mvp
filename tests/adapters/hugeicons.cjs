// Load real icon data on demand instead of evaluating the entire icon catalog.
module.exports = new Proxy(
	{},
	{
		get(_target, name) {
			if (name === "__esModule") return true;
			if (typeof name !== "string") return undefined;
			return require(`@hugeicons/core-free-icons/${name}`).default;
		},
	},
);
