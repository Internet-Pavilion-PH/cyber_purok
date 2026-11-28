<script lang="ts">
  type Props = {
    defaultName?: string;
    guavaCount?: number;
    onEnter?: (name: string) => void;
  };

  let { defaultName = "Player Hero", guavaCount = 0, onEnter }: Props = $props();
  let heroName = $state(defaultName);
  let isChoosingName = $state(false);

  const enterArena = (event: SubmitEvent) => {
    event.preventDefault();
    onEnter?.(heroName.trim());
  };
</script>

<div class="intro-scene" aria-label="Game intro scene">
  <section class:credit-page={!isChoosingName} class:choose-page={isChoosingName} aria-live="polite">
    <img class="logo" src="/images/cyber_purok2.png" alt="Cyber Purok logo" />

    {#if !isChoosingName}
      <div class="attributions">
        <p class="tagline">a project by Low Bandwidth Dreams</p>
        <p class="tagline">exploring the idea of Dagyaw</p>
        <p class="tagline">
          art assets from Salawaki, Jellyfish Kisses x Jetvlz,<br />
          Rogermond, Kirk Tabanera, V!ne, Jep Alaba, VariousB,<br />
          Roan Alvarez, Rhaz Oriente, Franco Mamaril
        </p>
        <p class="tagline">project lead by Roan Alvarez</p>
        <p class="tagline">code contributions from KoloWn and Roan Alvarez</p>
        <p class="tagline">contributions are welcome</p>
      </div>
      <button class="enter-button" type="button" onclick={() => (isChoosingName = true)}>
        Continue
      </button>
    {:else}
      <form class="enter-form" onsubmit={enterArena}>
        <h1>Profile</h1>
        <label for="hero-name">
          {guavaCount} {guavaCount === 1 ? "guava" : "guavas"} collected
        </label>
        <input
          id="hero-name"
          bind:value={heroName}
          type="text"
          maxlength="12"
          autocomplete="nickname"
          placeholder="Your hero name"
          required
        />
        <button class="enter-button" type="submit">Enter Cyber Purok</button>
        <!-- <button class="back-button" type="button" onclick={() => (isChoosingName = false)}>
          Back to credits
        </button> -->
      </form>
    {/if}
  </section>
</div>

<style>
  :global(body) {
    margin: 0;
    background: #000000;
  }

  .intro-scene {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    background: #000000;
    padding: 24px;
  }

  section {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    text-align: center;
    max-height: 100%;
  }

  .logo {
    display: block;
    max-width: min(76vw, 720px);
    width: 100%;
    height: auto;
    filter: drop-shadow(0 0 18px rgba(255, 255, 255, 0.12));
  }

  .tagline {
    margin: 0;
    max-width: 680px;
    color: rgba(174, 227, 123, 0.74);
    font-size: 0.85rem;
    line-height: 1.6;
    letter-spacing: 0.04em;
    text-align: center;
    font-family: 'Times New Roman', Times, serif;
  }

  .attributions {
    display: grid;
    gap: 0.5rem;
  }

  .enter-button {
    appearance: none;
    border: none;
    border-radius: 999px;
    padding: 0.9rem 2.2rem;
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;
    color: #02110a;
    background: #5fe38b;
    box-shadow: 0 0 0 1px rgba(95, 227, 139, 0.45), 0 10px 28px rgba(95, 227, 139, 0.22);
    transition: transform 0.15s ease, filter 0.15s ease;
      font-family: 'Times New Roman', Times, serif;
  }

  .enter-form {
    display: grid;
    width: min(100%, 360px);
    gap: 0.75rem;
  }

  .enter-form h1 {
    margin: 0.25rem 0 0;
    color: #aee37b;
    font-family: 'Times New Roman', Times, serif;
    font-size: clamp(1.35rem, 5vw, 2rem);
    font-weight: 400;
  }

  .enter-form label {
      color: rgba(174, 227, 123, 0.86);
      font-family: 'Times New Roman', Times, serif;
      font-size: 0.85rem;
  }

  .enter-form input {
      min-width: 0;
      border: 1px solid rgba(95, 227, 139, 0.55);
      border-radius: 999px;
      outline: none;
      background: transparent;
      color: #ebfff1;
      padding: 0.8rem 1rem;
      font: inherit;
      font-size: 16px;
      text-align: center;
  }

  .enter-form input:focus {
      box-shadow: 0 0 0 3px rgba(95, 227, 139, 0.18);
  }

  .enter-button:hover {
    transform: translateY(-1px);
    filter: brightness(1.05);
  
  }

  .enter-button:active {
    transform: translateY(0);
  }

 

  @media (max-height: 720px) {
    .intro-scene {
      padding: 14px;
    }

    .credit-page {
      gap: 0.65rem;
    }

    .credit-page .logo {
      max-width: min(58vw, 520px);
    }

    .credit-page .tagline {
      font-size: 0.75rem;
      line-height: 1.35;
    }

    .attributions {
      gap: 0.3rem;
    }
  }
</style>
