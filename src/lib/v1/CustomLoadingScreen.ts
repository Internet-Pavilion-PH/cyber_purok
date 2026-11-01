export class CustomLoadingScreen {
	imageUrl: string;
	_el: HTMLElement | null = null;
	// ILoadingScreen expected fields (provide defaults)
	loadingUIBackgroundColor = 'black';
	loadingUIText = '';

	constructor(imageUrl: string) {
		this.imageUrl = imageUrl;
	}

	displayLoadingUI() {
		if (typeof document === 'undefined') return;
		if (this._el) {
			this._el.style.display = 'flex';
			return;
		}
		this._el = document.createElement('div');
		this._el.id = 'custom-loading-ui';
		this._el.style.position = 'fixed';
		this._el.style.left = '0';
		this._el.style.top = '0';
		this._el.style.right = '0';
		this._el.style.bottom = '0';
		this._el.style.display = 'flex';
		this._el.style.alignItems = 'center';
		this._el.style.justifyContent = 'center';
		this._el.style.background = this.loadingUIBackgroundColor || 'black';
		this._el.style.zIndex = '2147483647';

		const img = document.createElement('img');
		img.src = this.imageUrl;
		img.alt = 'loading';
		img.style.maxWidth = '40%';
		img.style.maxHeight = '40%';
		img.style.objectFit = 'contain';
		this._el.appendChild(img);
		document.body.appendChild(this._el);
	}

	hideLoadingUI() {
		if (!this._el) return;
		try {
			this._el.style.display = 'none';
		} catch (e) {}
	}
}
