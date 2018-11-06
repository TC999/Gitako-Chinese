import DOMHelper, { REPO_TYPE_PRIVATE } from 'utils/DOMHelper'
import GitHubHelper, { NOT_FOUND, BAD_CREDENTIALS, API_RATE_LIMIT } from 'utils/GitHubHelper'
import configHelper from 'utils/configHelper'
import URLHelper from 'utils/URLHelper'
import keyHelper from 'utils/keyHelper'

const init = dispatch => async () => {
  try {
    if (!URLHelper.isInRepoPage()) return
    dispatch({ logoContainerElement: DOMHelper.insertLogoMountPoint() })
    let nothingWentWrong = true, branchDetected = false
    const metaData = URLHelper.parse()
    if (DOMHelper.isInCodePage()) {
      // in case GitHub page structure changes, fallback to 'master'
      const detectedBranchName = DOMHelper.getCurrentBranch() || 'master'
      metaData.branchName = detectedBranchName
      branchDetected = true
    } else {
      metaData.branchName = 'master'
      branchDetected = false
    }
    dispatch(setMetaData, metaData)
    const { access_token: accessToken, shortcut, compressSingletonFolder, copyFileButton, copySnippetButton } = await configHelper.get()
    DOMHelper.decorateGitHubPageContent({ copyFileButton, copySnippetButton })
    dispatch({ accessToken, toggleShowSideBarShortcut: shortcut, compressSingletonFolder, copyFileButton, copySnippetButton })
    const getTreeDataAggressively = GitHubHelper.getTreeData({
      ...metaData,
      accessToken,
    }).catch(() => {
      // 1. the repo has no master branch
      // 2. detect branch name from DOM failed
      // 3. not very possible...
      nothingWentWrong = false
    })
    let getTreeData = getTreeDataAggressively
    const metaDataFromAPI = await GitHubHelper.getRepoMeta({ ...metaData, accessToken })
    const projectDefaultBranchName = metaDataFromAPI['default_branch']
    if (!branchDetected && projectDefaultBranchName !== metaData.branchName) {
      // Accessing repo's non-homepage(no branch name in URL, nor in DOM)
      // We predicted its default branch to be 'master' and sent aggressive request
      // Throw that request due to the repo do not use {defaultBranchName} as default branch
      metaData.branchName = projectDefaultBranchName
      getTreeData = GitHubHelper.getTreeData({
        ...metaData,
        accessToken,
      })
    }
    Object.assign(metaData, { api: metaDataFromAPI })
    dispatch(setMetaData, metaData)
    const shouldShow = URLHelper.isInCodePage(metaData)
    dispatch(setShouldShow, nothingWentWrong && shouldShow)
    getTreeData
      .then(treeData => {
        dispatch({ treeData })
      })
      .catch(err => {
        dispatch(handleError, err)
      })
  } catch (err) {
    dispatch(handleError, err)
  }
}

const handleError = dispatch => async (err) => {
  // TODO: detect request time exceeds limit
  if (err.message === NOT_FOUND || err.message === BAD_CREDENTIALS || err.message === API_RATE_LIMIT ) {
    const repoPageType = await DOMHelper.getRepoPageType()
    const errorDueToAuth = repoPageType === REPO_TYPE_PRIVATE || err.message === BAD_CREDENTIALS || err.message === API_RATE_LIMIT
    dispatch({ errorDueToAuth })
    dispatch(setShowSettings, true)
    dispatch(setShouldShow, errorDueToAuth)
    if (!errorDueToAuth) {
      dispatch(setError, 'Gitako ate a bug, but it should recovery soon!')
    }
  } else {
    dispatch(setShouldShow, false)
    dispatch(setError, 'Gitako ate a bug, but it should recovery soon!')
  }
}

const onPJAXEnd = dispatch => () => {
  dispatch(({ metaData, copyFileButton, copySnippetButton }) => {
    DOMHelper.unmountTopProgressBar()
    DOMHelper.decorateGitHubPageContent({ copyFileButton, copySnippetButton })
    const mergedMetaData = { ...metaData, ...URLHelper.parse() }
    dispatch(setShouldShow, URLHelper.isInCodePage(mergedMetaData))
    dispatch(setMetaData, mergedMetaData)
  })
}

const onKeyDown = dispatch => e => {
  dispatch(({ toggleShowSideBarShortcut }) => {
    if (toggleShowSideBarShortcut) {
      const keys = keyHelper.parseEvent(e)
      if (keys === toggleShowSideBarShortcut) {
        dispatch(toggleShowSideBar)
      }
    }
  })
}

const toggleShowSideBar = dispatch => () => dispatch(({ shouldShow }) => dispatch(setShouldShow, !shouldShow))

const setShouldShow = dispatch => shouldShow => {
  dispatch({ shouldShow }, shouldShow ? DOMHelper.focusFileExplorer : null)
  DOMHelper.setBodyIndent(shouldShow)
}

const setError = dispatch => error => {
  dispatch({ error })
}

const toggleShowSettings = dispatch => () => dispatch(({ showSettings }) => ({ showSettings: !showSettings }))

const setShowSettings = dispatch => showSettings => dispatch({ showSettings })

const onAccessTokenChange = dispatch => accessToken => dispatch({ accessToken })

const onShortcutChange = dispatch => shortcut => dispatch({ toggleShowSideBarShortcut: shortcut })

const setMetaData = dispatch => metaData => dispatch({ metaData })

const setCompressSingleton = dispatch => compressSingletonFolder => dispatch({ compressSingletonFolder })

const setCopyFile = dispatch => copyFileButton => dispatch({ copyFileButton })

const setCopySnippet = dispatch => copySnippetButton => dispatch({ copySnippetButton })

export default {
  init,
  onPJAXEnd,
  onKeyDown,
  setShouldShow,
  setShowSettings,
  toggleShowSideBar,
  toggleShowSettings,
  onAccessTokenChange,
  onShortcutChange,
  setMetaData,
  setCompressSingleton,
  setCopyFile,
  setCopySnippet,
  setError,
  handleError,
}