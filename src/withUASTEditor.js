import React, { Component } from 'react';
import PropTypes from 'prop-types';
import PositionIndex from './PositionIndex';
import {
  toggleNodeById,
  hoverNodeById,
  highlightNodeById,
  expandToNodeId,
  expandRootIds
} from './helpers';
import { hocOptions as uastV2Options } from './uast-v2';

function isEqualArray(a1, a2) {
  if (a1.length !== a2.length) {
    return false;
  }

  for (let i = 0; i < a1.length; i++) {
    if (a1[i] !== a2[i]) {
      return false;
    }
  }

  return true;
}

// withUASTEditor creates High Ordered Component which connects Editor with FlatUASTViewer
// WrappedComponent - layout for componenets
// options
// options.transformer - function that converts uast to flat-json
// options.getNodePosition - function that returns position in codemirror format from node
// options.getChildrenIds - function that returns array of all children ids
function withUASTEditor(WrappedComponent, options = uastV2Options) {
  const initialState = {
    flatUast: null,
    // control highlighted node
    lastHighlighted: null,
    // position (line, ch) of nodes
    hoverPos: null,
    clickPos: null
  };

  const { getNodePosition, getChildrenIds } = options;

  class UASTEditorWrapper extends Component {
    constructor(props) {
      super(props);

      this.state = this.stateFromProps(props);

      this.onNodeHover = this.onNodeHover.bind(this);
      this.onNodeToggle = this.onNodeToggle.bind(this);
      this.onNodeClick = this.onNodeClick.bind(this);
      this.onCursorChanged = this.onCursorChanged.bind(this);
    }

    // wrapper keeps it's own uast but it should be recalculated when props are changed
    // eslint-disable-next-line
    UNSAFE_componentWillReceiveProps(nextProps) {
      let { state } = this;

      if (nextProps.uast !== this.props.uast) {
        state = this.stateFromProps(nextProps);
      } else if (
        !isEqualArray(nextProps.rootIds, this.props.rootIds) ||
        nextProps.levelsToExpand !== this.props.levelsToExpand
      ) {
        state = this.resetUast(
          state.flatUast,
          nextProps.rootIds,
          nextProps.levelsToExpand
        );
      }

      if (state !== this.state) {
        this.setState(state);
      }
    }

    stateFromProps({ uast, rootIds, levelsToExpand }) {
      this.posIndex = new PositionIndex();

      if (!uast) {
        return initialState;
      }

      const flatUast = options.transformer(uast);

      if (getNodePosition) {
        Object.keys(flatUast).forEach(id => {
          const node = flatUast[id];
          const { from, to } = getNodePosition(node);
          if (!from || !to) {
            return;
          }

          this.posIndex.add(node.id, [from.line, from.ch], [to.line, to.ch]);
        });
      }

      return this.resetUast(flatUast, rootIds, levelsToExpand);
    }

    resetUast(flatUast, rootIds, levelsToExpand) {
      return {
        ...initialState,
        flatUast: expandRootIds(
          flatUast,
          rootIds,
          levelsToExpand,
          getChildrenIds
        )
      };
    }

    onNodeHover(id, prevId) {
      if (!getNodePosition) {
        return;
      }

      const { flatUast } = this.state;
      const node = flatUast[id];
      const newFlatUast = hoverNodeById(flatUast, id, prevId);

      if (!node) {
        this.setState({
          flatUast: newFlatUast,
          hoverPos: null
        });
        return;
      }

      const hoverPos = getNodePosition(node);

      this.setState({ flatUast: newFlatUast, hoverPos });
    }

    onNodeToggle(id) {
      const { flatUast } = this.state;
      const newFlatUast = toggleNodeById(flatUast, id);
      this.setState({ flatUast: newFlatUast });
    }

    onNodeClick(id) {
      if (!getNodePosition) {
        return;
      }

      const { flatUast } = this.state;
      const node = flatUast[id];

      if (!node) {
        this.setState({ clickPos: null });
        return;
      }

      const clickPos = getNodePosition(node);
      this.setState({ clickPos });
    }

    onCursorChanged(cursorPos) {
      const nodeId = this.posIndex.get(cursorPos.line, cursorPos.ch);
      if (!nodeId) {
        return;
      }
      const { flatUast, lastHighlighted } = this.state;
      const newFlatUast = highlightNodeById(flatUast, nodeId, lastHighlighted);
      this.setState({
        flatUast: expandToNodeId(newFlatUast, nodeId),
        lastHighlighted: nodeId
      });
    }

    render() {
      const { code, languageMode, rootIds, ...rest } = this.props;

      return (
        <WrappedComponent
          editorProps={{
            code,
            languageMode,
            markRange: this.state.hoverPos,
            scrollToPos: this.state.clickPos,
            onCursorChanged: this.onCursorChanged
          }}
          uastViewerProps={{
            rootIds,
            flatUast: this.state.flatUast,
            scrollToNode: this.state.lastHighlighted,
            onNodeHover: this.onNodeHover,
            onNodeToggle: this.onNodeToggle,
            onNodeClick: this.onNodeClick
          }}
          {...rest}
        />
      );
    }
  }

  UASTEditorWrapper.propTypes = {
    // source UAST in the format matching transformer
    uast: PropTypes.any,
    // source code for uast
    code: PropTypes.string,
    // language mode in codemirror format, use languageToMode helper if needed
    languageMode: PropTypes.string,
    // array of root nodes ids
    rootIds: PropTypes.array.isRequired,
    // number of node levels to expand from rootIds
    levelsToExpand: PropTypes.number.isRequired
  };

  UASTEditorWrapper.defaultProps = {
    rootIds: [1],
    levelsToExpand: 2
  };

  return UASTEditorWrapper;
}

export default withUASTEditor;
