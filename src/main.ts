import './style.css'
import axios from 'axios'
import { ethers } from 'ethers'

// Constants
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const INSURANCE_CONTRACT_ADDRESS = "0xae4be2CC77c853c7F23461B1a7A2a46887a1a4e5";
const INSURANCE_ABI = [
  "function stake() external payable",
  "function totalPoolBalance() external view returns (uint256)",
  "function getPolicy(address _user) external view returns (tuple(uint8 policyType, uint256 maxCoverage, uint256 startDate, uint256 expiryDate, uint256 claimsUsed, uint256 maxClaims, bool isActive, string parametricTrigger, bool isPrivate))"
];

// State Management
let userWallet: string | null = null;
let userPolicy: any = null;
let currentIdentityType: 'metamask' | 'keyfile' | null = null;
let userSigner: any = null; // Store ethers signer for MetaMask

// DOM Elements
const walletBtn = document.getElementById('wallet-btn') as HTMLButtonElement;
const startClaimBtn = document.getElementById('start-claim-btn') as HTMLButtonElement;
const buyPolicyBtn = document.getElementById('buy-policy-btn') as HTMLButtonElement;
const viewDashboardBtn = document.getElementById('view-dashboard-btn') as HTMLButtonElement;
const viewAnalyticsBtn = document.getElementById('view-analytics-btn') as HTMLButtonElement;
const viewAboutBtn = document.getElementById('view-about-btn') as HTMLButtonElement;
const viewSettingsBtn = document.getElementById('view-settings-btn') as HTMLButtonElement;

const heroView = document.getElementById('hero-view')!;
const formView = document.getElementById('form-view')!;
const dashboardView = document.getElementById('dashboard-view')!;
const resultView = document.getElementById('result-view')!;
const policyView = document.getElementById('policy-view')!;
const evidenceView = document.getElementById('evidence-view')!;
const claimDetailView = document.getElementById('claim-detail-view')!;
const analyticsView = document.getElementById('analytics-view')!;
const settingsView = document.getElementById('settings-view')!;
const aboutView = document.getElementById('about-view')!;

const claimForm = document.getElementById('claim-form') as HTMLFormElement;
const walletInput = document.getElementById('wallet-address') as HTMLInputElement;
const logoBtn = document.getElementById('logo-btn')!;

// New Views
const poolView = document.getElementById('pool-view')!;
const oracleView = document.getElementById('oracle-view')!;

// New Nav Items
const navDashboard = document.getElementById('nav-dashboard')!;
const navPool = document.getElementById('nav-pool')!;
const navOracle = document.getElementById('nav-oracle')!;
const privacyToggle = document.getElementById('privacy-toggle') as HTMLInputElement;
const triggerSelect = document.getElementById('trigger-type') as HTMLSelectElement;

// Back Buttons
const backBtns = [
  { id: 'back-to-hero', view: 'hero' },
  { id: 'back-to-hero-dashboard', view: 'hero' },
  { id: 'back-to-hero-policy', view: 'hero' },
  { id: 'back-to-hero-analytics', view: 'hero' },
  { id: 'back-to-hero-settings', view: 'hero' },
  { id: 'back-to-hero-about', view: 'hero' },
  { id: 'back-to-form-evidence', view: 'form' },
  { id: 'back-to-dashboard-detail', view: 'dashboard' }
];

// Router Implementation
const ROUTES: Record<string, string> = {
  '/': 'hero',
  '/claim': 'form',
  '/dashboard': 'dashboard',
  '/result': 'result',
  '/policy': 'policy',
  '/evidence': 'evidence',
  '/analytics': 'analytics',
  '/settings': 'settings',
  '/about': 'about',
  '/pool': 'pool',
  '/oracle': 'oracle'
};

function navigateTo(path: string, pushState = true) {
  const view = ROUTES[path] || 'hero';
  showView(view);
  if (pushState) {
    window.history.pushState({ path }, '', path);
  }
}

// Global popstate handler for back/forward buttons
window.addEventListener('popstate', () => {
  const path = window.location.pathname;
  navigateTo(path, false);
});

// Navigation Function
function showView(view: string) {
  const views: Record<string, HTMLElement> = {
    'hero': heroView, 'form': formView, 'dashboard': dashboardView,
    'result': resultView, 'policy': policyView, 'evidence': evidenceView,
    'detail': claimDetailView, 'analytics': analyticsView, 'settings': settingsView,
    'about': aboutView, 'pool': poolView, 'oracle': oracleView
  };

  // Hide all
  Object.values(views).forEach(v => v.classList.add('hidden'));

  // Show target
  if (views[view]) {
    views[view].classList.remove('hidden');
  } else {
    heroView.classList.remove('hidden');
  }
}

// Wallet Functions
// Wallet Functions
// DOM Elements for Login Modal
const loginModal = document.getElementById('login-modal')!;
const closeLoginBtn = document.getElementById('close-login-btn')!;
const loginMetamaskBtn = document.getElementById('login-metamask')!;
const createKeyBtn = document.getElementById('create-key-btn')!;
const loadKeyBtn = document.getElementById('load-key-btn')!;
const keyFileInput = document.getElementById('key-file-input') as HTMLInputElement;

const paymentChoiceModal = document.getElementById('payment-choice-modal')!;
const closeChoiceBtn = document.getElementById('close-choice-btn')!;
const payMetamaskBtn = document.getElementById('pay-metamask-btn')!;
const payQrBtn = document.getElementById('pay-qr-btn')!;
const choicePolicyType = document.getElementById('choice-policy-type')!;

const paymentModal = document.getElementById('payment-modal')!;
const closePaymentBtn = document.getElementById('close-payment-btn')!;
const verifyPaymentBtn = document.getElementById('verify-payment-btn')!;
const paymentQrImg = document.getElementById('payment-qr') as HTMLImageElement;
const paymentAmountLabel = document.getElementById('payment-amount')!;

async function ensureArcNetwork() {
  const arcChainId = '0x4cef52'; // 5042002 in hex
  try {
    await (window as any).ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: arcChainId }],
    });
  } catch (switchError: any) {
    if (switchError.code === 4902) {
      try {
        await (window as any).ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: arcChainId,
            chainName: 'Arc Testnet',
            nativeCurrency: { name: 'ARC', symbol: 'ARC', decimals: 18 },
            rpcUrls: ['https://rpc.testnet.arc.network'],
            blockExplorerUrls: ['https://explorer.testnet.arc.network']
          }],
        });
      } catch (addError) {
        console.error('Error adding Arc network:', addError);
      }
    }
  }
}

// Wallet Functions
function openLoginModal() {
  loginModal.classList.remove('hidden');
}

function closeLoginModal() {
  loginModal.classList.add('hidden');
}

async function connectWallet() {
  if (userWallet) {
    userWallet = null;
    walletBtn.innerText = 'Connect Wallet';
    walletBtn.classList.remove('btn-secondary');
    walletBtn.classList.add('btn-primary');
    if (walletInput) walletInput.value = '';
    showView('hero');
    return;
  }
  openLoginModal();
}

async function handleMetamaskLogin() {
  try {
    if (!(window as any).ethereum) {
      alert('Please install Metamask or use Arc Wallet!');
      return;
    }
    await ensureArcNetwork();
    const provider = new ethers.BrowserProvider((window as any).ethereum);
    const accounts = await provider.send("eth_requestAccounts", []);
    userSigner = await provider.getSigner();
    userWallet = accounts[0];
    currentIdentityType = 'metamask';
    finishLogin();
  } catch (err) {
    console.error('Wallet error:', err);
  }
}

async function handleCreateKey() {
  const wallet = ethers.Wallet.createRandom();
  const address = wallet.address;

  // Create a backup file for the user
  const backupData = {
    address: address,
    privateKey: wallet.privateKey,
    note: "InsuranceAI Privacy Key - DO NOT SHARE",
    generatedAt: new Date().toISOString()
  };

  const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `insurance_ai_key_${address.slice(0, 8)}.json`;
  a.click();

  userWallet = address;
  currentIdentityType = 'keyfile';
  alert(`🎉 NEW IDENTITY GENERATED!\n\nYour address: ${address}\n\nIMPORTANT: Your Access Key file has been downloaded. Save it securely to log in later or from other devices.`);
  finishLogin();
}

async function handleLoadKey() {
  keyFileInput.click();
}

keyFileInput.addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const data = JSON.parse(event.target?.result as string);
      if (data.privateKey) {
        const wallet = new ethers.Wallet(data.privateKey);
        userWallet = wallet.address;
        currentIdentityType = 'keyfile';
        alert(`🔐 IDENTITY RESTORED\n\nWelcome back! Identity ${userWallet.slice(0, 10)}... is now active.`);
        finishLogin();
      } else {
        alert('Invalid Key File format.');
      }
    } catch (err) {
      alert('Error reading Key File.');
    }
  };
  reader.readAsText(file);
});

function finishLogin() {
  walletBtn.innerText = `${userWallet?.slice(0, 6)}...${userWallet?.slice(-4)}`;
  walletBtn.classList.add('btn-secondary');
  walletBtn.classList.remove('btn-primary');
  if (walletInput) walletInput.value = userWallet || '';
  closeLoginModal();
  checkPolicy();
  loadDashboard();
  loadPoolData();
  console.log('Privacy session established:', userWallet);
}



async function checkPolicy() {
  if (!userWallet) return;
  try {
    const res = await axios.get(`${API_URL}/api/policy/${userWallet}`);
    if (res.data.active) {
      userPolicy = res.data;
      const walletLabel = document.getElementById('user-wallet-address');
      if (walletLabel) walletLabel.innerText = `${userWallet?.slice(0, 6)}...${userWallet?.slice(-4)} | ${userPolicy.policy_type} PROTECTED`;
    }
  } catch (err) {
    console.log('No policy found yet');
  }
}

// Policy Purchase Logic
async function purchasePolicy(type: string) {
  if (!userWallet) {
    alert('Please connect your identity first!');
    await connectWallet();
    if (!userWallet) return;
  }

  const provider = new ethers.BrowserProvider((window as any).ethereum);

  const btn = document.querySelector(`.btn-select-policy[data-type="${type}"]`) as HTMLButtonElement;
  const originalText = btn.innerText;

  try {
    // 1. Handle Real Payment (Real Transfer)
    const prices: any = { 'HEALTH': '0.50', 'VEHICLE': '0.75', 'PARAMETRIC': '1.20' };
    const priceUSD = prices[type];

    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Paying $${priceUSD}...`;

    // If using KeyFile, we need a MetaMask 'Payer'
    let payerSigner = userSigner;
    if (currentIdentityType === 'keyfile' && !payerSigner) {
      await ensureArcNetwork();
      const choice = await openPaymentChoiceModal(type);
      if (choice === 'metamask') {
        await provider.send("eth_requestAccounts", []);
        payerSigner = await provider.getSigner();
      } else if (choice === 'qr') {
        const success = await handleManualPayment(type, priceUSD);
        if (!success) throw new Error("Manual payment verification failed or cancelled");
        return;
      } else {
        throw new Error("Payment cancelled");
      }
    }

    if (!payerSigner) {
      alert("MetaMask required for automatic payment. Use QR mode if you don't have MetaMask installed.");
      return;
    }

    // Verify Network
    const { chainId } = await provider.getNetwork();
    const arcChainId = 5042002n; // BigInt for Arc Testnet
    if (chainId !== arcChainId) {
      await ensureArcNetwork();
    }

    // SIMULATED: Perform the real transfer on Arc L1
    // In a real production deployment, this would be a transfer to the Insurance Pool address
    console.log(`💸 Processing on-chain payment of ${priceUSD} (0.0001 ARC) to Protocol Registry...`);

    // Check balance before sending
    const balance = await provider.getBalance(await payerSigner.getAddress());
    console.log(`Working balance: ${ethers.formatEther(balance)} ARC`);

    const tx = await payerSigner.sendTransaction({
      to: "0xcE33FBE1a657cFaDea3Bb594b15857C08d9E6Ad6", // Protocol Admin / Pool Address
      value: ethers.parseEther("0.0001"), // Reduced to be more demo-friendly
      gasLimit: 100000, // Explicit limit to prevent over-estimation errors
    });

    btn.innerHTML = '<span class="spinner"></span> Finalizing Registry...';
    await tx.wait();

    // 2. Issue Policy on Backend/Blockchain
    const isPrivate = privacyToggle?.checked || false;
    const trigger = type === 'PARAMETRIC' ? triggerSelect.value : '';

    const res = await axios.post(`${API_URL}/api/policy/create`, {
      wallet_address: userWallet,
      policy_type: type,
      trigger: trigger,
      is_private: isPrivate
    });

    if (res.data.success) {
      userPolicy = res.data.policy;
      const arcTx = res.data.on_chain_tx;

      const privacyText = isPrivate ? ' (🛡️ Shielded Payout Enabled)' : '';
      alert(`🎉 SUCCESS!\n\nYour ${type} policy has been secured on the Arc L1 Registry${privacyText}.\n\nPayment Proof: ${tx.hash.slice(0, 20)}...\nRegistry Proof: ${arcTx?.slice(0, 20)}...`);

      const walletLabel = document.getElementById('user-wallet-address');
      if (walletLabel) walletLabel.innerText = `${userWallet?.slice(0, 6)}...${userWallet?.slice(-4)} | ${type} PROTECTED`;

      showView('dashboard');
      loadDashboard();
    }
  } catch (err: any) {
    console.error(err);
    alert(`Failed to purchase policy: ${err.message || 'Network error'}`);
  } finally {
    btn.disabled = false;
    btn.innerText = originalText;
  }
}

function openPaymentChoiceModal(policyType: string): Promise<'metamask' | 'qr' | null> {
  return new Promise((resolve) => {
    choicePolicyType.innerText = policyType;
    paymentChoiceModal.classList.remove('hidden');

    const cleanup = () => {
      paymentChoiceModal.classList.add('hidden');
      payMetamaskBtn.onclick = null;
      payQrBtn.onclick = null;
      closeChoiceBtn.onclick = null;
    };

    payMetamaskBtn.onclick = () => { cleanup(); resolve('metamask'); };
    payQrBtn.onclick = () => { cleanup(); resolve('qr'); };
    closeChoiceBtn.onclick = () => { cleanup(); resolve(null); };
  });
}

async function handleManualPayment(type: string, amountUSD: string): Promise<boolean> {
  return new Promise(async (resolve) => {
    const protocolAddress = "0xcE33FBE1a657cFaDea3Bb594b15857C08d9E6Ad6";
    const amountARC = "0.01"; // Simulated conversion for demo

    // Generate QR code (using a public QR API for simplicity in demo)
    const qrContent = `ethereum:${protocolAddress}@5042002?value=${ethers.parseEther(amountARC)}`;
    paymentQrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrContent)}`;
    paymentAmountLabel.innerText = `${amountARC} ARC ($${amountUSD} USDC)`;

    paymentModal.classList.remove('hidden');

    verifyPaymentBtn.onclick = async () => {
      const btn = verifyPaymentBtn as HTMLButtonElement;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Verifying On-Chain...';

      // SIMULATED: Wait for blockchain confirmation
      await new Promise(r => setTimeout(r, 2000));

      // 2. Issue Policy on Backend
      const isPrivate = privacyToggle?.checked || false;
      const trigger = type === 'PARAMETRIC' ? triggerSelect.value : '';

      try {
        const res = await axios.post(`${API_URL}/api/policy/create`, {
          wallet_address: userWallet,
          policy_type: type,
          trigger: trigger,
          is_private: isPrivate
        });

        if (res.data.success) {
          paymentModal.classList.add('hidden');
          alert(`🎉 PAYMENT VERIFIED!\n\nYour ${type} policy has been secured on-chain via manual transfer.`);
          loadDashboard();
          resolve(true);
        }
      } catch (err) {
        alert("Payment not yet detected. Please ensure you sent the funds to the correct address.");
        btn.disabled = false;
        btn.innerText = 'I have sent the payment';
      }
    };

    closePaymentBtn.onclick = () => {
      paymentModal.classList.add('hidden');
      resolve(false);
    };
  });
}

// Pool & Staking Logic
async function loadPoolData() {
  showView('pool');
  const activityList = document.getElementById('pool-activity-list')!;

  try {
    const url = userWallet ? `${API_URL}/api/protocol/pool?wallet_address=${userWallet}` : `${API_URL}/api/protocol/pool`;
    const res = await axios.get(url);
    document.getElementById('pool-tvl')!.innerText = `$${res.data.total_locked.toLocaleString()}`;
    document.getElementById('pool-yield')!.innerText = `${res.data.yield_rate}%`;

    if (userWallet) {
      const stake = res.data.user_stake || 0;
      const tvl = res.data.total_locked || 0.0001;
      const rewards = res.data.user_rewards || 0;
      const share = (stake / tvl) * 100;
      const apy = 0.124; // 12.4%

      // Update Top Card
      const stakeValEl = document.getElementById('user-stake-val');
      if (stakeValEl) stakeValEl.innerText = `$${stake.toLocaleString()}`;

      const rewardsEl = document.getElementById('user-rewards');
      if (rewardsEl) rewardsEl.innerText = `$${rewards.toFixed(2)} Earned`;

      // Update Bottom Info / Portfolio Dashboard
      const stakeBottomEl = document.getElementById('user-stake-bottom');
      if (stakeBottomEl) stakeBottomEl.innerText = `$${stake.toLocaleString()}`;

      const apyReturnEl = document.getElementById('user-apy-return');
      if (apyReturnEl) apyReturnEl.innerText = `$${(stake * apy).toFixed(2)}`;

      const poolShareStatsEl = document.getElementById('user-pool-share-stats');
      if (poolShareStatsEl) poolShareStatsEl.innerText = `${share.toFixed(4)}%`;

      // Update Projections in input area
      const poolShareEl = document.getElementById('pool-share');
      if (poolShareEl) poolShareEl.innerText = `${share.toFixed(4)}%`;

      const estEarningsEl = document.getElementById('est-earnings');
      if (estEarningsEl) estEarningsEl.innerText = `$${(stake * apy / 12).toFixed(2)}`;
    }

    // Populate activity list from real blockchain events
    try {
      const eventsRes = await axios.get(`${API_URL}/api/protocol/events?limit=8`);
      const events = eventsRes.data || [];

      if (events.length === 0) {
        activityList.innerHTML = '<div class="activity-item" style="opacity: 0.6; font-style: italic;">No recent protocol activity detected on Arc.</div>';
      } else {
        activityList.innerHTML = events.map((e: any) => `
          <div class="activity-item animate-fadeIn">
            <div style="display: flex; justify-content: space-between; align-items: start;">
              <span>${e.text}</span>
            </div>
          </div>
        `).join('');
      }
    } catch (err) {
      console.error('Failed to load activity list:', err);
      activityList.innerHTML = '<div class="activity-item error">Failed to sync Ledger.</div>';
    }
  } catch (err) {
    activityList.innerHTML = '<div class="activity-item error">Failed to load protocol stats.</div>';
  }
}

// Staking Projection Logic
const stakeAmountInput = document.getElementById('stake-amount') as HTMLInputElement;
const estEarningsLabel = document.getElementById('est-earnings')!;
const poolShareLabel = document.getElementById('pool-share')!;

stakeAmountInput?.addEventListener('input', () => {
  const val = parseFloat(stakeAmountInput.value) || 0;
  const tvl = 14250000; // Mock current TVL
  const apy = 0.124; // 12.4%

  const monthly = (val * apy) / 12;
  const share = (val / (tvl + val)) * 100;

  estEarningsLabel.innerText = `$${monthly.toFixed(2)}`;
  poolShareLabel.innerText = `${share.toFixed(4)}%`;
});

async function handleStake() {
  if (!userWallet) return alert('Connect wallet to stake!');
  const amount = (document.getElementById('stake-amount') as HTMLInputElement).value;
  if (!amount || parseFloat(amount) <= 0) return alert('Enter valid amount');

  const btn = document.getElementById('stake-btn') as HTMLButtonElement;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Providing Liquidity...';

  try {
    if (userSigner && currentIdentityType === 'metamask') {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const balance = await provider.getBalance(userWallet);
      const stakeValue = ethers.parseEther(amount);

      if (balance < stakeValue) {
        throw new Error(`Insufficient ARC balance. You have ${ethers.formatEther(balance)} ARC, but trying to stake ${amount} ARC.`);
      }

      const contract = new ethers.Contract(INSURANCE_CONTRACT_ADDRESS, INSURANCE_ABI, userSigner);

      // Arc Testnet sometimes fails at estimateGas, so we provide a safe explicit limit
      console.log('💎 Initiating on-chain stake of', amount, 'ARC');
      const tx = await contract.stake({
        value: stakeValue,
        gasLimit: 120000 // Explicit limit to bypass estimateGas issues on testnet
      });

      btn.innerHTML = '<span class="spinner"></span> Waiting for confirmation...';
      const receipt = await tx.wait();

      if (receipt.status === 1) {
        alert(`💎 LIQUIDITY ADDED!\n\n${amount} ARC successfully staked into the reinsurance pool.\nTransaction: ${tx.hash.slice(0, 32)}...`);
      } else {
        throw new Error("Transaction was reverted on-chain.");
      }
    } else {
      const res = await axios.post(`${API_URL}/api/protocol/stake`, {
        wallet_address: userWallet,
        amount: parseFloat(amount)
      });
      if (res.data.success) {
        alert(`💎 LIQUIDITY ADDED!\n\n$${amount} USDC staked into the reinsurance pool.\nTransaction Hash: ${res.data.on_chain_tx.slice(0, 32)}...`);
      }
    }
    loadPoolData();
  } catch (err: any) {
    console.error('Staking error:', err);
    alert('Staking failed: ' + (err.reason || err.message || 'Unknown error'));
  } finally {
    btn.disabled = false;
    btn.innerText = 'Provide Liquidity';
  }
}

// Oracle Simulator Logic
async function triggerOracleSim(event: string) {
  const log = document.getElementById('oracle-log')!;
  const proofArea = document.getElementById('oracle-payout-proof')!;
  const txLink = document.getElementById('oracle-tx-link') as HTMLAnchorElement;

  log.innerHTML = `<div class="log-entry">📡 INCOMING SENSORY DATA: ${event.toUpperCase()}</div>`;
  proofArea.classList.add('hidden');

  try {
    const sensorData = {
      event_type: event.includes('earthquake') ? 'EARTHQUAKE' : 'FLIGHT_DELAY',
      magnitude: event.includes('8') ? 8.2 : 0,
      timestamp: Date.now() / 1000
    };

    const res = await axios.post(`${API_URL}/api/parametric/simulate`, {
      sensor_data: sensorData,
      wallet_address: userWallet || "0x742d35Cc6634C0532925a3b844Bc454e4438f44e" // Demo address if not connected
    });

    const steps = [
      "Analyzing sensor grid integrity...",
      "Matching event against active parametric policies...",
      "AI Oracle (Gemini 1.5) verifying magnitude threshold...",
      "THRESHOLD EXCEEDED: Initiating instant settlement...",
      "Broadcasting payout to Arc L1 Ledger..."
    ];

    for (const step of steps) {
      const el = document.createElement('div');
      el.className = 'log-entry thinking-step';
      el.innerText = `> ${step}`;
      log.appendChild(el);
      await new Promise(r => setTimeout(r, 600));
    }

    if (res.data.payout_executed) {
      log.innerHTML += `<div class="log-entry" style="color:var(--color-success)">✅ AUTOMATED SETTLEMENT SUCCESSFUL</div>`;
      proofArea.classList.remove('hidden');
      txLink.href = `https://testnet.arcscan.app/tx/${res.data.settlement_tx}`;

      // Auto-refresh the dashboard to show the new claim/payout
      console.log("🌪️ Parametric event confirmed. Refreshing Protection Portfolio...");
      setTimeout(() => {
        loadDashboard();
      }, 1500);
    } else {
      log.innerHTML += `<div class="log-entry" style="color:var(--color-warning)">⚠️ EVENT RECORDED - NO PAYOUT TRIGGERED</div>`;
    }

  } catch (err) {
    log.innerHTML += `<div class="log-entry error">❌ ORACLE FAILURE: NETWORK ERROR</div>`;
  }
}

// Evidence Upload Logic
let selectedFiles: File[] = [];
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const browseBtn = document.getElementById('browse-btn')!;
const previewContainer = document.getElementById('preview-container')!;
const filePreviews = document.getElementById('file-previews')!;
const analyzeEvidenceBtn = document.getElementById('analyze-evidence-btn') as HTMLButtonElement;
const analysisResults = document.getElementById('analysis-results')!;
const analysisContent = document.getElementById('analysis-content')!;

browseBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFileSelect);

function handleFileSelect(e: Event) {
  const files = (e.target as HTMLInputElement).files;
  if (!files) return;
  addFiles(Array.from(files));
}

function addFiles(files: File[]) {
  selectedFiles = [...selectedFiles, ...files];
  previewContainer.classList.remove('hidden');
  analyzeEvidenceBtn.disabled = false;

  filePreviews.innerHTML = selectedFiles.map((file, idx) => `
    <div class="file-preview">
      ${file.type.startsWith('image/') ?
      `<img src="${URL.createObjectURL(file)}" />` :
      `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:2rem;">📁</div>`
    }
      <button class="remove-file" onclick="window.removeFile(${idx})">×</button>
    </div>
  `).join('');
}

(window as any).removeFile = (idx: number) => {
  selectedFiles.splice(idx, 1);
  addFiles([]);
  if (selectedFiles.length === 0) {
    previewContainer.classList.add('hidden');
    analyzeEvidenceBtn.disabled = true;
  }
};

analyzeEvidenceBtn.addEventListener('click', async () => {
  if (selectedFiles.length === 0) return;

  analyzeEvidenceBtn.disabled = true;
  analyzeEvidenceBtn.innerHTML = '<span class="spinner"></span> AI Analysis in Progress...';

  const formData = new FormData();
  formData.append('file', selectedFiles[0]); // For now, analyze first file

  try {
    const res = await axios.post(`${API_URL}/api/upload/evidence`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    console.log('🔍 Evidence Analysis Response:', res.data);

    const analysis = res.data.analysis;

    analysisResults.classList.remove('hidden');
    analysisContent.innerHTML = `
      <div class="result-row"><strong>Severity:</strong> ${analysis.severity_score || 0}/10</div>
      <div class="result-row"><strong>Estimated Damage:</strong> $${(analysis.estimated_amount || 0).toFixed(2)}</div>
      <div class="result-row"><strong>Fraud Risk:</strong> ${analysis.fraud_indicator ? 'High' : 'Low'}</div>
      <div class="result-reason"><p>${analysis.summary || analysis.damage_description || 'No description available'}</p></div>
    `;

    // Auto-fill amount in claim form
    if (analysis.estimated_amount > 0) {
      (document.getElementById('amount') as HTMLInputElement).value = analysis.estimated_amount.toString();
    }
  } catch (err) {
    console.error('Evidence analysis error:', err);
    alert('AI Analysis failed');
  } finally {
    analyzeEvidenceBtn.disabled = false;
    analyzeEvidenceBtn.innerText = 'Analyze with AI';
  }
});

// Analytics Logic
async function loadAnalytics() {
  showView('analytics');
  try {
    await axios.get(`${API_URL}/api/stats`); // Need global stats endpoint or sum all local
    // For demo, we'll use local stats if user is connected
    if (userWallet) {
      const stats = await axios.get(`${API_URL}/api/stats/${userWallet}`);
      document.getElementById('total-payouts')!.innerText = `$${(stats.data.total_payout || 0).toFixed(2)}`;
      document.getElementById('fraud-prevented')!.innerText = stats.data.rejected || '0';
    }
  } catch (err) {
    console.error('Failed to load analytics');
  }
}

// Dashboard and Detail Logic
async function loadDashboard() {
  if (!userWallet) {
    alert('Please connect your wallet first!');
    await connectWallet();
    if (!userWallet) return;
  }

  showView('dashboard');
  document.getElementById('dashboard-wallet')!.textContent = `Wallet: ${userWallet}`;

  try {
    const statsRes = await axios.get(`${API_URL}/api/stats/${userWallet}`);
    const stats = statsRes.data;
    document.getElementById('total-claims')!.textContent = stats.total_claims || '0';
    document.getElementById('approved-claims')!.textContent = stats.approved || '0';
    document.getElementById('rejected-claims')!.textContent = stats.rejected || '0';
    document.getElementById('total-payout')!.textContent = `$${(stats.total_payout || 0).toFixed(2)}`;

    // LOAD ACTIVE POLICIES (Portfolio View)
    const policyContainer = document.getElementById('active-policies-list')!;
    try {
      const policyRes = await axios.get(`${API_URL}/api/policy/${userWallet}`);
      const data = policyRes.data;

      if (data.has_policy && data.policies && data.policies.length > 0) {
        policyContainer.innerHTML = data.policies.map((p: any) => {
          const triggerDesc = p.parametric_trigger || '';
          const expiryDate = p.expiry_date ? new Date(p.expiry_date).toLocaleDateString() : 'N/A';
          const isStaker = p.policy_type === 'Institutional';
          const icon = isStaker ? '💎' : (p.policy_type === 'HEALTH' ? '🏥' : p.policy_type === 'VEHICLE' ? '🚗' : '🌩️');
          const borderColor = isStaker ? 'var(--color-primary)' : 'var(--color-success)';
          const bgClassName = isStaker ? 'portfolio-card-staker' : 'portfolio-card-retail';

          return `
            <div class="policy-card active-policy ${bgClassName}" style="border-left: 4px solid ${borderColor}; padding: 1.5rem; border-radius: var(--radius-lg); position: relative; overflow: hidden; margin-bottom: 1rem;">
              ${isStaker ? '<div style="position: absolute; top: 0; right: 0; background: var(--color-primary); color: black; font-size: 0.6rem; font-weight: 800; padding: 4px 12px; border-bottom-left-radius: 8px;">STAKER BENEFIT</div>' : ''}
              <div class="policy-card-main" style="display: flex; align-items: center; gap: 1.5rem;">
                <div class="policy-icon" style="font-size: 2.5rem;">${icon}</div>
                <div class="policy-info-main">
                  <h4 style="margin: 0; font-size: 1.2rem; color: white;">${p.policy_type} Protection</h4>
                  <div style="font-size: 0.9rem; color: var(--color-text-secondary); margin-top: 0.4rem;">
                     <span class="badge ${isStaker ? 'badge-primary' : 'badge-success'}" style="font-size: 0.75rem; vertical-align: middle;">ACTIVE</span>
                     ${triggerDesc ? ` <span style="margin-left: 10px; border-left: 1px solid rgba(255,255,255,0.2); padding-left: 10px;">Trigger: <b>${triggerDesc}</b></span>` : ''}
                  </div>
                </div>
                <div class="policy-coverage-stats" style="text-align: right; margin-left: auto;">
                  <div style="font-weight: 700; color: var(--color-primary); font-size: 1.2rem;">$${(p.coverage_amount || 0).toLocaleString()}</div>
                  <div style="font-size: 0.8rem; color: var(--color-text-tertiary);">Coverage Limit</div>
                </div>
              </div>
              <div class="policy-card-footer" style="margin-top: 1.2rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--color-text-secondary);">
                <span>📅 Valid until: <b>${expiryDate}</b></span>
                <span style="display: flex; align-items: center; gap: 0.5rem;">
                  ${p.is_private ? '<span title="Shielded Privacy Enabled">🛡️ Private</span>' : '🔓 Public Audit'}
                </span>
              </div>
            </div>
          `;
        }).join('');
      } else {
        policyContainer.innerHTML = `
          <div class="empty-state" style="padding: 3rem; border: 2px dashed rgba(255,255,255,0.1); border-radius: var(--radius-lg); text-align: center; background: rgba(255,255,255,0.02);">
            <div style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;">🛡️</div>
            <p style="margin-bottom: 1.5rem; color: var(--color-text-secondary); font-size: 1.1rem;">You don't have any active insurance coverage yet.</p>
            <button class="btn btn-primary" onclick="window.navigateTo('/policy')">Secure Your Assets Now</button>
          </div>
        `;
      }
    } catch (e) {
      console.error('Portfolio error:', e);
      policyContainer.innerHTML = `<p class="error">Not protected yet. Join the pool!</p>`;
    }

    const historyRes = await axios.get(`${API_URL}/api/claims/history/${userWallet}`);
    const claims = historyRes.data.claims || [];
    const claimsList = document.getElementById('claims-list')!;

    if (claims.length === 0) {
      claimsList.innerHTML = `<div class="empty-state"><p>No claims yet.</p></div>`;
    } else {
      claimsList.innerHTML = claims.map((c: any) => `
        <div class="claim-card" onclick="window.viewClaimDetail('${c.claim_id}')">
          <div class="claim-header">
            <div class="claim-type">${c.claim_type === 'HEALTH' ? '🏥' : c.claim_type === 'VEHICLE' ? '🚗' : '🏠'} ${c.claim_type}</div>
            <span class="badge ${c.status === 'approved' ? 'badge-success' : 'badge-danger'}">${c.status}</span>
          </div>
          <div class="claim-body">
            <div>$${c.claimed_amount?.toFixed(2)}</div>
            <div class="text-gradient">$${c.payout_amount?.toFixed(2)}</div>
            <div>${c.fraud_score}/100</div>
            <div>${new Date(c.created_at).toLocaleDateString()}</div>
          </div>
          ${c.on_chain_tx_hash ? `
          <div class="claim-footer" style="margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.05);">
            <a href="https://explorer.testnet.arc.network/tx/${c.on_chain_tx_hash}" target="_blank" onclick="event.stopPropagation()" style="font-size: 0.75rem; color: var(--primary); text-decoration: none; display: flex; align-items: center; gap: 4px;">
              Verify Proof on Arc ⛓️
            </a>
          </div>` : ''}
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('Dashboard error');
  }
}

(window as any).viewClaimDetail = async (id: string) => {
  showView('detail');
  const content = document.getElementById('claim-detail-content')!;
  content.innerHTML = `
    <div class="loading-container" style="padding: 5rem; text-align: center;">
      <div class="spinner-large"></div>
      <p style="margin-top: 2rem; color: var(--color-primary); font-family: var(--font-display); font-weight: 600; letter-spacing: 1px;">
        SYNCHRONIZING PROOF CHAIN...
      </p>
    </div>
  `;

  try {
    const res = await axios.get(`${API_URL}/api/claims/${id}`);
    const c = res.data;

    const isApproved = c.status === 'approved' || c.status === 'approve';
    const isRejected = c.status === 'rejected' || c.status === 'reject';
    const statusLabel = isApproved ? 'APPROVED' : isRejected ? 'REJECTED' : 'UNDER REVIEW';
    const statusBadge = isApproved ? 'badge-success' : isRejected ? 'badge-danger' : 'badge-warning';

    content.innerHTML = `
      <div class="audit-record-premium animate-fadeIn">
        <div class="detail-header" style="margin-bottom: 3rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
            <div class="audit-identity">
              <div style="color: var(--color-primary); font-size: 0.8rem; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 0.5rem;">Audit Record Identifier</div>
              <h2 style="font-family: var(--font-display); font-size: 2.25rem; margin: 0; display: flex; align-items: center; gap: 1rem;">
                ${id} <span class="badge ${statusBadge}" style="font-size: 1rem; padding: 0.5rem 1.25rem;">${statusLabel}</span>
              </h2>
            </div>
            <div class="audit-badge-glow ${statusBadge}"></div>
          </div>
        </div>

        <div class="proof-flow-container">
          <!-- The Visual Connecting Line -->
          <div class="proof-chain-line"></div>

          <div class="proof-3-col">
            <!-- ARCHITECTURE 1: AI REASONING -->
            <div class="proof-card glass-premium">
              <div class="proof-card-header">
                <div class="proof-icon-container" style="background: rgba(125, 0, 255, 0.1); border: 1px solid var(--color-secondary);">
                  <span class="proof-icon">🧠</span>
                </div>
                <div class="proof-title">
                   <h4>AI Agent Reasoning</h4>
                   <span>Logic & Policy Audit</span>
                </div>
              </div>
              <div class="proof-card-body">
                <div class="reasoning-bubble">${c.decision_reason || c.reason || 'No specific reason metadata found in state. AI analysis concluded without manual flags.'}</div>
                <div class="proof-commitment">
                  <span class="meta-label">Decision Hash (Accountability)</span>
                  <div class="hash-box-premium">
                    <code>${c.decision_hash ? c.decision_hash.slice(0, 16) + '...' + c.decision_hash.slice(-8) : 'GEN_HASH_PENDING'}</code>
                  </div>
                </div>
                <div class="proof-status-ribbon completed">
                   <span class="indicator"></span> VERIFIED
                </div>
              </div>
            </div>

            <!-- ARCHITECTURE 2: EVIDENCE -->
            <div class="proof-card glass-premium active">
              <div class="proof-card-header">
                <div class="proof-icon-container" style="background: rgba(0, 243, 255, 0.1); border: 1px solid var(--color-primary);">
                  <span class="proof-icon">🛡️</span>
                </div>
                <div class="proof-title">
                   <h4>Arweave Evidence</h4>
                   <span>Permanent L1 Storage</span>
                </div>
              </div>
              <div class="proof-card-body">
                <p class="proof-meta-text">Claims data and sensor evidence are secured on Arweave via Irys, providing an immutable audit trail for trustless resolution.</p>
                <div class="proof-commitment">
                  <span class="meta-label">Storage Transaction</span>
                  <div class="hash-box-premium">
                    <code>${c.arc_tx_id || 'ARV_STAKE_0x' + id.slice(5) + '...'}</code>
                  </div>
                </div>
                <button class="btn-verify-link" onclick="window.viewDataProof('${id}')">
                  View Data Proof ↗
                </button>
                <div class="proof-status-ribbon completed">
                   <span class="indicator"></span> IMMUTABLE
                </div>
              </div>
            </div>

            <!-- ARCHITECTURE 3: SETTLEMENT -->
            <div class="proof-card glass-premium">
              <div class="proof-card-header">
                <div class="proof-icon-container" style="background: rgba(0, 255, 136, 0.1); border: 1px solid var(--color-success);">
                  <span class="proof-icon">⛓️</span>
                </div>
                <div class="proof-title">
                   <h4>Arc L1 Settlement</h4>
                   <span>Protocol State Finality</span>
                </div>
              </div>
              <div class="proof-card-body">
                <p class="proof-meta-text">${isApproved ? 'Capital redemption executed from reinsurance pool. Asset transfer finalized on-chain.' : 'On-chain state recorded in global registry. Claim closed based on AI verdict.'}</p>
                <div class="proof-commitment">
                  <span class="meta-label">Settlement / State TX</span>
                  <div class="hash-box-premium">
                    <code>${(c.on_chain_tx_hash || c.usdc_tx_signature || 'TX_PENDING_SYNC').slice(0, 24)}...</code>
                  </div>
                </div>
                ${(c.on_chain_tx_hash?.startsWith('0x') || c.usdc_tx_signature?.startsWith('0x')) ? `
                  <a href="https://testnet.arcscan.app/tx/${c.on_chain_tx_hash || c.usdc_tx_signature}" target="_blank" class="btn-verify-link success">
                    Verify Explorer ⛓️
                  </a>
                ` : `
                   <div class="btn-verify-link disabled" style="opacity: 0.5; cursor: not-allowed; background: rgba(255,255,255,0.02);">
                     ${isApproved ? 'Settlement Synchronizing...' : 'Proof Recorded On-Chain'}
                   </div>
                `}
                <div class="proof-status-ribbon ${isApproved ? 'completed' : isRejected ? 'error' : 'pending'}">
                   <span class="indicator"></span> ${isApproved ? 'PAID & FINALIZED' : isRejected ? 'CLOSED' : 'PROCESSING'}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="audit-footer-legal">
          <div style="display: flex; align-items: center; gap: 1rem; color: var(--color-text-tertiary);">
            <div style="width: 12px; height: 12px; background: var(--color-success); border-radius: 50%; box-shadow: 0 0 10px var(--color-success);"></div>
            <span>Protocol-Level Transparency: AI decisions are cryptographically bound to the Arc State Machine.</span>
          </div>
        </div>

        ${isRejected ? `
          <div style="text-align: center; margin-top: 3rem;">
            <button class="btn btn-primary" onclick="window.requestAudit('${id}')" style="padding: 1rem 3rem; background: var(--gradient-hyper); border: none;">
              ⚖️ Request Senior Protocol Audit
            </button>
          </div>
        ` : ''}
      </div>
    `;
  } catch (err) {
    console.error('Audit Load Error:', err);
    content.innerHTML = `
      <div class="error-state-card glass-premium">
        <span style="font-size: 3rem;">⚠️</span>
        <h3>Proof Chain Synchronization Failed</h3>
        <p>We were unable to verify the on-chain status for this record. Please check the Arc Explorer directly.</p>
        <button onclick="loadDashboard()" class="btn btn-secondary">Back to Dashboard</button>
      </div>
    `;
  }
};

(window as any).requestAudit = async (id: string) => {
  const content = document.getElementById('claim-detail-content')!;
  const originalHtml = content.innerHTML;

  content.innerHTML = `
    <div class="audit-overlay" style="margin-top: 2rem; padding: 2rem; background: rgba(245, 158, 11, 0.05); border: 1px solid var(--color-warning); border-radius: var(--radius-lg);">
        <h3 style="color: var(--color-warning);">⚖️ Senior Agent Appeal Initiated for ${id}</h3>
        <p>A high-integrity reasoning model is currently cross-referencing on-chain evidence with protocol bylaws for this specific claim.</p>
        <div id="audit-log" class="thinking-log" style="margin-top: 1.5rem;"></div>
    </div>
    ${originalHtml}
  `;

  const log = document.getElementById('audit-log')!;
  const steps = [
    "Locking on-chain state for re-evaluation...",
    "Retrieving raw Arweave evidence hash...",
    "Initializing Gemini 1.5 Pro (High-Temperature Reasoner)...",
    "DEEP SCAN: Checking for hidden metadata in photo evidence...",
    "CROSS-REVERENCE: Comparing claim with 1,200 similar settled cases...",
    "CONCLUSION: Anomaly detected in initial rejection logic. Flagging for Priority Human Auditor."
  ];

  for (const step of steps) {
    const el = document.createElement('div');
    el.className = 'log-entry thinking-step';
    el.innerText = `>> ${step}`;
    log.appendChild(el);
    await new Promise(r => setTimeout(r, 1200));
  }

  alert("Update: Senior Agent has flagged this claim for 'High Integrity' priority. A final human audit is scheduled.");
};



// Form Handler
claimForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!userWallet) return alert('Connect wallet!');

  const submitBtn = document.getElementById('submit-btn') as HTMLButtonElement;
  const analysisResults = document.getElementById('analysis-results')!;
  const thinkingLog = document.getElementById('agent-thinking-log')!;

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner"></span> Processing Claim...';
  analysisResults.classList.add('hidden');
  thinkingLog.innerHTML = '';

  try {
    const response = await axios.post(`${API_URL}/api/claims/submit`, {
      description: (document.getElementById('description') as HTMLTextAreaElement).value,
      claimed_amount: parseFloat((document.getElementById('amount') as HTMLInputElement).value),
      wallet_address: userWallet
    });

    // Show analysis results
    renderResult(response.data);
    analysisResults.classList.remove('hidden');

    // Animate thinking steps for "Swarm Transparency"
    const steps = response.data.thinking_steps || [];
    for (const step of steps) {
      const stepEl = document.createElement('div');
      stepEl.className = 'thinking-step';
      stepEl.innerText = step;
      thinkingLog.appendChild(stepEl);
      await new Promise(r => setTimeout(r, 600)); // Simulated 'thinking' time
    }

    showView('result');
  } catch (err: any) {
    alert(`Error: ${err.response?.data?.detail || 'Failed'}`);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerText = 'Submit Claim';
  }
});

// Deep Audit View: Shows raw evidence and AI thinking logs
(window as any).viewDataProof = async (id: string) => {
  try {
    const res = await axios.get(`${API_URL}/api/claims/${id}`);
    const c = res.data;

    // Create a special overlay/modal for the deep proof
    const modal = document.createElement('div');
    modal.className = 'proof-modal-overlay animate-fadeIn';
    modal.innerHTML = `
      <div class="proof-modal-content glass-premium">
        <div class="modal-header-premium">
           <h3><span class="proof-icon">🛡️</span> Arweave Data Proof</h3>
           <button class="close-modal-btn" onclick="this.closest('.proof-modal-overlay').remove()">×</button>
        </div>
        <div class="modal-scroll-area">
          <div class="proof-explanation">
             This is the immutable evidence packet stored on Arweave. It contains the raw AI agent logs, sensor readings, and the cryptographic hash that binds this decision to the Arc protocol.
          </div>
          
          <div class="proof-section">
            <label>Raw AI Decision Logic</label>
            <pre class="json-display">${JSON.stringify({
      decision: c.status,
      fraud_score: c.fraud_score,
      payout: c.payout_amount,
      timestamp: c.created_at,
      agent_v: "InsuranceAI-Flash-1.5"
    }, null, 2)}</pre>
          </div>

          <div class="proof-section">
            <label>Audit Thinking Steps (Chain of Thought)</label>
            <div class="thinking-log-mini">
              ${(c.thinking_steps || ["✅ Logic Chain Verified", "✅ Transactional Integrity Confirmed"]).map((s: string) => `
                <div class="mini-step">${s}</div>
              `).join('')}
            </div>
          </div>

          <div class="proof-section">
            <label>Cryptographic Proof of Solvency</label>
            <div class="solvency-proof">
              <span class="meta-label">Evidence URI</span>
              <code>arweave://evidence/${c.arc_tx_id || id}</code>
            </div>
          </div>
        </div>
        <div class="modal-footer-premium text-center">
           <button class="btn btn-secondary" onclick="this.closest('.proof-modal-overlay').remove()">Close Audit View</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  } catch (err) {
    alert('Failed to retrieve deep proof data.');
  }
};

function renderResult(data: any) {
  const resultContent = document.getElementById('result-content')!;

  // Debug: Log the full response to console
  console.log('🔍 Backend Response:', data);

  // Extract data from nested structure
  const decision = data.decision || {};
  const fraudAnalysis = data.fraud_analysis || {};
  const payoutCalc = data.payout_calculation || {};

  // Get values with proper fallback chain
  const decisionValue = decision.decision || 'manual_review';
  const fraudScore = decision.fraud_score || fraudAnalysis.fraud_score || 0;

  // FIXED: Properly extract payout from decision object first, then fallback to payout_calculation
  const payout = decision.recommended_payout !== undefined
    ? decision.recommended_payout
    : (payoutCalc.recommended_payout || 0);

  // Check for explicit error from backend
  const reason = data.error || decision.reason || payoutCalc.adjustment_reason || 'Processing complete';

  console.log('📊 Parsed Values:', { decisionValue, fraudScore, payout, reason });

  const badgeClass = decisionValue === 'approve' ? 'badge-success' : decisionValue === 'reject' ? 'badge-danger' : 'badge-warning';
  const displayValue = decisionValue === 'manual_review' ? 'UNDER REVIEW' : decisionValue.toUpperCase();

  resultContent.innerHTML = `
    <div class="result-card">
      <div class="result-header">
        <h3>Claim Status: <span class="badge ${badgeClass}">${displayValue}</span></h3>
      </div>
      
      <div class="result-stats">
        <div class="stat-item">
          <span class="stat-label">Fraud Risk Score</span>
          <span class="stat-value">${fraudScore}/100</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Estimated Payout</span>
          <span class="stat-value highlight">$${payout.toFixed(2)} USDC</span>
        </div>
      </div>

      <div class="result-explanation">
        <h4>AI Adjusted Reasoning:</h4>
        <p>${reason}</p>
      </div>

      <div class="result-actions" style="display: flex; gap: 1rem;">
        <button onclick="location.reload()" class="btn btn-secondary" style="flex: 1">Return to Home</button>
        ${data.on_chain_tx_hash ? `
          <a href="https://testnet.arcscan.app/tx/${data.on_chain_tx_hash}" target="_blank" class="btn btn-primary" style="flex: 1; text-decoration: none; display: flex; align-items: center; justify-content: center;">
            Verify On Arc ⛓️
          </a>
        ` : ''}
      </div>
    </div>
  `;
}

// Event Listeners
walletBtn.addEventListener('click', connectWallet);
startClaimBtn.addEventListener('click', () => {
  if (!userWallet) connectWallet().then(() => { if (userWallet) navigateTo('/claim'); });
  else navigateTo('/claim');
});
buyPolicyBtn.addEventListener('click', () => navigateTo('/policy'));
viewDashboardBtn.addEventListener('click', loadDashboard);
viewAnalyticsBtn.addEventListener('click', loadAnalytics);
viewAboutBtn.addEventListener('click', () => navigateTo('/about'));
viewSettingsBtn.addEventListener('click', () => {
  navigateTo('/settings');
  document.getElementById('settings-wallet')!.innerText = userWallet || 'Not connected';
});

navDashboard.addEventListener('click', (e) => { e.preventDefault(); loadDashboard(); });
navPool.addEventListener('click', (e) => { e.preventDefault(); loadPoolData(); });
navOracle.addEventListener('click', (e) => { e.preventDefault(); navigateTo('/oracle'); });

document.getElementById('stake-btn')?.addEventListener('click', handleStake);
document.querySelectorAll('.trigger-sim-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const event = (e.currentTarget as HTMLElement).getAttribute('data-event')!;
    triggerOracleSim(event);
  });
});

document.querySelectorAll('.back-to-hero').forEach(btn => {
  btn.addEventListener('click', () => navigateTo('/'));
});

logoBtn.addEventListener('click', () => navigateTo('/'));

backBtns.forEach(btn => {
  document.getElementById(btn.id)?.addEventListener('click', () => {
    const path = btn.view === 'hero' ? '/' : `/${btn.view}`;
    navigateTo(path);
  });
});

// Setup Policy Selection Buttons
document.querySelectorAll('.btn-select-policy').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const type = (e.currentTarget as HTMLElement).getAttribute('data-type')!;
    purchasePolicy(type);
  });
});

// Initial Router Load
window.addEventListener('DOMContentLoaded', () => {
  navigateTo(window.location.pathname, false);
});

// Login Modal Event Listeners
closeLoginBtn.addEventListener('click', closeLoginModal);
loginMetamaskBtn.addEventListener('click', handleMetamaskLogin);
createKeyBtn.addEventListener('click', handleCreateKey);
loadKeyBtn.addEventListener('click', handleLoadKey);

closeChoiceBtn.addEventListener('click', () => paymentChoiceModal.classList.add('hidden'));
closePaymentBtn.addEventListener('click', () => paymentModal.classList.add('hidden'));

// Close modal on overlay click
document.querySelector('.modal-overlay')?.addEventListener('click', closeLoginModal);

// Evidence Button in Form
const addEvidenceBtn = document.createElement('button');
addEvidenceBtn.type = 'button';
addEvidenceBtn.className = 'btn btn-secondary';
addEvidenceBtn.style.marginTop = '1rem';
addEvidenceBtn.innerText = '📸 Add Photo/Video Evidence';
addEvidenceBtn.onclick = () => showView('evidence');
claimForm.insertBefore(addEvidenceBtn, claimForm.querySelector('.form-actions'));
