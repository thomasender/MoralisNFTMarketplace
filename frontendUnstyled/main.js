//ROPSTEN TESTNET

// Moralis.initialize("5va9LOQklpjULOZ4tCmPsGZgeTbmiUEtjvVpTf7B");
// Moralis.serverURL = 'https://r9wufvqrbjmo.moralis.io:2053/server'

// const TOKEN_CONTRACT_ADDRESS = "0xb6306837191257840D8ec3584094B48400B789B1";



// GanacheGUI Local

const TOKEN_CONTRACT_ADDRESS = "0x0e0b671c24201c4B58dC92634132DB1a662a8F5f";
const MARKETPLACE_CONTRACT_ADDRESS ="0x396757273579F52de074B4b52408b6BC4ceEf9Ef";

Moralis.initialize("r7pn7TKgCBTpHLYep4pwVq0oBCroGHb2CXJkghKw");
Moralis.serverURL = 'https://tk2chwlnrcce.moralis.io:2053/server'


init = async () => {
    hideElement(userItemsSection);
    window.web3 = await Moralis.Web3.enable();
    window.tokenContract = new web3.eth.Contract(tokenContractAbi, TOKEN_CONTRACT_ADDRESS);
    window.marketplaceContract = new web3.eth.Contract(marketplaceContractAbi, MARKETPLACE_CONTRACT_ADDRESS);
    initUser();
    loadItems();

    const soldItemsQuery = Moralis.Query('SoldItems');
    const soldItemsSubscription = await soldItemsQuery.subscribe();
    soldItemsSubscription.on('create', onItemSold);

    const itemsAddedQuery = Moralis.Query('ItemsForSale');
    const itemsAddedSubscription = await itemsAddedQuery.subscribe();
    itemsAddedSubscription.on('create', onItemAdded);
}

onItemSold = async (item) => {
    const listing = document.getElementById(`item-${item.attributes.uid}`);
    if (listing) {
        listing.parentNode.removeChild(listing);
    }

    user = await Moralis.User.current();
    if(user){
        const params = {uid: `${item.attributes.uid}`};
        const soldItem = await Moralis.Cloud.run('getItem', params);
        if(soldItem){
            if (user.get('accounts').includes(item.attributes.buyer)){
                getAndRenderItemData(soldItem, renderUserItem);
            }

            const userItemListing = document.getElementById(`user-item-${item.tokenObjectId}`);
            if(userItemListing) userItemListing.parentNode.removeChild(userItemListing);

        } 
    }
} 

onItemAdded = async (item) => {
    const params = {uid: `${item.attributes.uid}`};
    const addedItem = await Moralis.Cloud.run('getItem', params);
    if(addedItem){
        user = await Moralis.User.current();
        if(user){
            if (user.get('accounts').includes(addedItem.ownerOf)){
                const userItemListing = document.getElementById(`user-item-${item.tokenObjectId}`);
                if(userItemListing) userItemListing.parentNode.removeChild(userItemListing);

                getAndRenderItemData(addedItem, renderUserItem);
                return;
            }
        }  
        getAndRenderItemData(addedItem, renderItem);
    } 
} 

initUser = async () => {
    if(await Moralis.User.current()){
        hideElement(userConnectButton);
        showElement(userProfileButton);
        showElement(openCreateItemButton);
        showElement(openUserItemsButton);
        loadUserItems();
    }else{
        showElement(userConnectButton); 
        hideElement(userProfileButton);
        hideElement(openCreateItemButton);
        hideElement(openUserItemsButton);
    }
}

login = async () => {
    try{
        await Moralis.Web3.authenticate();
        location.reload();
    } catch (error){
        console.log(error);
    }
}

logout = async () => {
    await Moralis.User.logOut();
    hideElement(userInfo);
    initUser();
}

openUserInfo = async () => {
    user = await Moralis.User.current();
    if (user){
        const email = user.get('email');
        if(email){
            userEmailField.value = email;
        } else {
            userEmailField.value = "";
        }

        userUsernameField.value = user.get('username');

        const userAvatar = user.get('avatar');
        if(userAvatar){
            userAvatarImg.src = userAvatar.url();
            showElement(userAvatarImg);
        } else {
            hideElement(userAvatarImg);
        }

        $('#userInfo').modal('show');
    } else {
        login();
    }
}

saveUserInfo = async () => {
    user.set('email', userEmailField.value);
    user.set('username', userUsernameField.value);

    if (userAvatarFile.files.length > 0) {
        const avatar = new Moralis.File("avatar.jpg", userAvatarFile.files[0]);
        user.set('avatar', avatar);
      }
    
    await user.save();
    alert("User Info saved successfully");
    openUserInfo();
}

createItem = async () => {
    if(createItemFile.files.length == 0){
        alert("Please select a file!");
        return;
    } else if (createItemNameField.value.length == 0 ){
        alert("Please name the item!");
        return;
    }

    const nftFile = new Moralis.File("nftFile.jpg", createItemFile.files[0]);
    await nftFile.saveIPFS();

    const nftFilePath = nftFile.ipfs();

    const metadata = {
        name: createItemNameField.value,
        description: createItemDescriptionField.value,
        image: nftFilePath
    };

    const nftFileMetadataFile = new Moralis.File("metadata.json", {base64 : btoa(JSON.stringify(metadata))});
    await nftFileMetadataFile.saveIPFS();

    const nftFileMetaDataFilePath = nftFileMetadataFile.ipfs();

    const nftId = await mintNft(nftFileMetaDataFilePath);

    user = await Moralis.User.current();
    const userAddress = user.get('ethAddress');

    switch(createItemStatusField.value){
        case "0": 
            return;
        case "1": 
            await ensureMarketplaceIsApproved(nftId, TOKEN_CONTRACT_ADDRESS);
            await marketplaceContract.methods.addItemToMarket(nftId, TOKEN_CONTRACT_ADDRESS, createItemPriceField.value).send({from: userAddress});
            break;
        case "2":
            alert("Not yet supported!");
            return;
    }   
    
}

mintNft = async (metadataUrl) => {
    const receipt = await tokenContract.methods.createItem(metadataUrl).send({from: ethereum.selectedAddress});
    console.log(receipt);
    return receipt.events.Transfer.returnValues.tokenId;
}

openUserItems = async () => {
    user = await Moralis.User.current();
    if (user){
        showElement(userItemsSection);
    } else {
        login();
    }
}

loadUserItems = async () => {
    const ownedItems = await Moralis.Cloud.run("getUserItems");
    ownedItems.forEach(item => {
        const userItemListing = document.getElementById(`user-item-${item.tokenObjectId}`);
        if(userItemListing) return;
        getAndRenderItemData(item, renderUserItem);
    });
}

loadItems = async () => {
    const items = await Moralis.Cloud.run("getItems");
    user = await Moralis.User.current();
    items.forEach(item => {
        if(user){
            if (user.attributes.accounts.includes(item.ownerOf)){
                const userItemListing = document.getElementById(`user-item-${item.tokenObjectId}`);
                if(userItemListing) userItemListing.parentNode.removeChild(userItemListing);
                getAndRenderItemData(item, renderUserItem);
                return;
            }
        }
        getAndRenderItemData(item, renderItem);
    });
}

//Very interesting function for initializing a template div!
initTemplate = (id) => {
    const template = document.getElementById(id);  //gets reference to the div existing in the html
    template.id = ""; //sets it to nothing
    template.parentNode.removeChild(template); //"removes" child of template, I guess? But div is still available as reference!!
    return template;
} 

renderUserItem = async (item) => {
    const userItemListing = document.getElementById(`user-item-${item.tokenObjectId}`);
    if(userItemListing) return;

    const userItem = userItemTemplate.cloneNode(true);
    userItem.getElementsByTagName("img")[0].src = item.image;
    userItem.getElementsByTagName("img")[0].alt = item.name;
    userItem.getElementsByTagName("h5")[0].innerText = item.name;
    userItem.getElementsByTagName("p")[0].innerText = item.description;
    
    userItem.getElementsByTagName("input")[0].value = item.askingPrice ?? 1;
    userItem.getElementsByTagName("input")[0].disabled = item.askingPrice > 0;
    userItem.getElementsByTagName("button")[0].disabled = item.askingPrice > 0;
    userItem.getElementsByTagName("button")[0].onclick = async () => {
        user = await Moralis.User.current();
        if(!user){
            login();
            return;
        }
        await ensureMarketplaceIsApproved(item.tokenId, item.tokenAddress);
        await marketplaceContract.methods.addItemToMarket(item.tokenId, item.tokenAddress, userItem.getElementsByTagName("input")[0].value).send({from: user.get('ethAddress')});
        
    }

    userItem.id = `user-item${item.tokenObjectId}`;
    userItems.appendChild(userItem);

}

renderItem = (item) => {
    const itemForSale = marketplaceItemTemplate.cloneNode(true);
    if(item.sellerAvatar){
        itemForSale.getElementsByTagName("img")[0].src = item.sellerAvatar.url();
        itemForSale.getElementsByTagName("img")[0].alt = item.sellerUserName;
        itemForSale.getElementsByTagName("span")[0].innerText = item.sellerUserName;
    }
    itemForSale.getElementsByTagName("img")[1].src = item.image;
    itemForSale.getElementsByTagName("img")[1].alt = item.name;
    itemForSale.getElementsByTagName("h5")[0].innerText = item.name;
    itemForSale.getElementsByTagName("p")[0].innerText = item.description;
    itemForSale.getElementsByTagName("button")[0].innerText = `Buy for ${item.askingPrice} WEI`;
    itemForSale.getElementsByTagName("button")[0].onclick = () => buyItem(item);
    
    itemForSale.id = `item-${item.uid}`;
    itemsForSale.appendChild(itemForSale);

}

getAndRenderItemData = (item, renderFunction) => {
    fetch(item.tokenuri)
    .then(response => response.json())
    .then(data => {
        item.name = data.name;
        item.description = data.description;
        item.image = data.image;
        renderFunction(item);        
    })

}

ensureMarketplaceIsApproved = async (tokenId, tokenAddress) => {
    user = await Moralis.User.current();
    const userAddress = user.get('ethAddress');
    const contract = new web3.eth.Contract(tokenContractAbi, tokenAddress);
    const approvedAddress = await contract.methods.getApproved(tokenId).call({from: userAddress});
    if(approvedAddress != MARKETPLACE_CONTRACT_ADDRESS){
        await contract.methods.approve(MARKETPLACE_CONTRACT_ADDRESS, tokenId).send({from: userAddress});
    }

}

buyItem = async (item) => {
    const user = await Moralis.User.current();
    if(!user){
        login();
        return;
    }
    await marketplaceContract.methods.buyItem(item.uid).send({from: user.get('ethAddress'), value: item.askingPrice});
} 

hideElement = (element) => element.style.display = 'none';
showElement = (element) => element.style.display = 'block';


//NAVBAR
const userConnectButton = document.getElementById("btnConnect");
userConnectButton.onclick = login;
const userProfileButton = document.getElementById("btnProfileInfo");
userProfileButton.onclick = openUserInfo;
const openCreateItemButton = document.getElementById("btnOpenCreateItem");
openCreateItemButton.onclick = () => showElement(createItemForm);


// USER PROFILE
const userInfo = document.getElementById("userInfo");
const userUsernameField = document.getElementById("textUsername");
const userEmailField = document.getElementById("textEmail");
const userAvatarImg = document.getElementById("imgAvatar");
const userAvatarFile = document.getElementById("fileAvatar");

document.getElementById("btnCloseUserInfo").onclick = () => hideElement(userInfo);
document.getElementById("btnLogout").onclick = logout;
document.getElementById("btnSaveUserInfo").onclick = saveUserInfo;


//ITEM CREATION
const createItemForm = document.getElementById("createItem");
const createItemNameField = document.getElementById("textCreateItemName");
const createItemDescriptionField = document.getElementById("textCreateItemDescription");
const createItemPriceField = document.getElementById("numberCreateItemPrice");
const createItemStatusField = document.getElementById("selectCreateItemStatus");
const createItemFile = document.getElementById("fileCreateItemFile");

document.getElementById("btnCloseCreateItem").onclick = () => hideElement(createItemForm);
document.getElementById("btnCreateItem").onclick = createItem;

//USER ITEMS
const userItemsSection = document.getElementById("userItems");
const userItems = document.getElementById("userItemsList");
document.getElementById("btnCloseUserItems").onclick = () => hideElement(userItemsSection);
const openUserItemsButton = document.getElementById("btnMyItems");
openUserItemsButton.onclick = openUserItems;

const userItemTemplate = initTemplate("itemTemplate"); //removes the div itemTemplate from the html document, but keep the structure in userItemTemplate!!! Very nice function!!
const marketplaceItemTemplate = initTemplate("marketplaceItemTemplate");

//ITEMS FOR SALE

const itemsForSale = document.getElementById("itemsForSale");
init();