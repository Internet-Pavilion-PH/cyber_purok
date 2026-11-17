const apicallURL = "https://kolown.net/api/bot/cyberpurok";

export async function kolownbot(name: string) {
	const response = await fetch(apicallURL, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
		},
		body: new URLSearchParams({ name }).toString(),
	});

	if (!response.ok) {
		throw new Error(`Failed to send name to kolownbot API: ${response.status}`);
	}

	return response.json();
}